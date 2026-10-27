"use client"

import * as React from "react"

import type { EstadoIntegracion } from "@/lib/etl/api-tipos"
import { crearLotes, ejecutarLotes, huellaFilas, resumenLotes } from "@/lib/etl/carga"
import { CIUDADES, buscarCiudad } from "@/lib/etl/ciudades"
import { enviarLote, verificarLotes } from "@/lib/etl/cliente-api"
import { construirUrl, descargarCiudad } from "@/lib/etl/extraccion"
import { hoyUtc, validarRango } from "@/lib/etl/fechas"
import { calcularSeleccion, filtrosIniciales, ORDEN_INICIAL, type Filtros, type Orden } from "@/lib/etl/filtros"
import { formatoEntero } from "@/lib/etl/formato"
import { procesarRespuestas } from "@/lib/etl/pipeline"
import { aFilaCarga } from "@/lib/etl/tipos"
import { Contadores } from "./contadores"
import { PanelMapa } from "./panel-mapa"
import { SeccionCarga } from "./seccion-carga"
import { SeccionConfiguracion } from "./seccion-configuracion"
import { SeccionInspeccion } from "./seccion-inspeccion"
import { SeccionPipeline, type Fase } from "./seccion-pipeline"
import { SeccionSeleccion } from "./seccion-seleccion"
import type { Carga, Extraccion, ExtraccionCiudad, PestanaInspeccion } from "./tipos-sesion"

function horasRecibidas(c: ExtraccionCiudad): number {
  const time = (c.json as { hourly?: { time?: unknown } } | undefined)?.hourly?.time
  return Array.isArray(time) ? time.length : 0
}

export function BancoTrabajo() {
  // ── Configuración ──────────────────────────────────────────────
  const [hoy] = React.useState(() => hoyUtc())
  const [ciudadesSel, setCiudadesSel] = React.useState<string[]>(() => CIUDADES.map((c) => c.id))
  const [inicio, setInicio] = React.useState("2026-09-01")
  const [fin, setFin] = React.useState("2026-09-30")
  const validacion = React.useMemo(() => validarRango(inicio, fin), [inicio, fin])
  // Ciudad activa: compartida por el mapa y las pestañas de ciudad del JSON original.
  const [ciudadActiva, setCiudadActiva] = React.useState(CIUDADES[0].id)

  // ── Extracción (los JSON originales se conservan en memoria durante la sesión) ──
  const [extraccion, setExtraccion] = React.useState<Extraccion | null>(null)
  const extraccionRef = React.useRef<Extraccion | null>(null)
  const [extrayendo, setExtrayendo] = React.useState(false)

  // ── Filtrado y selección ───────────────────────────────────────
  const [filtros, setFiltros] = React.useState<Filtros>(() => filtrosIniciales([]))
  const [orden, setOrden] = React.useState<Orden>(ORDEN_INICIAL)
  const [seleccion, setSeleccion] = React.useState<Set<string>>(() => new Set())

  // ── Carga ──────────────────────────────────────────────────────
  const [carga, setCarga] = React.useState<Carga | null>(null)
  const cargandoRef = React.useRef(false)
  const [integracion, setIntegracion] = React.useState<EstadoIntegracion | null>(null)
  const [versionDestino, setVersionDestino] = React.useState(0)
  const [pestana, setPestana] = React.useState<PestanaInspeccion>("json")

  React.useEffect(() => {
    fetch("/api/estado", { cache: "no-store" })
      .then((r) => r.json() as Promise<EstadoIntegracion>)
      .then(setIntegracion)
      .catch(() =>
        setIntegracion({
          habilitado: false,
          configurado: false,
          tablaDisponible: false,
          mensaje: "No se pudo consultar el estado de la integración.",
        })
      )
  }, [versionDestino])

  const actualizarExtraccion = (fn: (e: Extraccion) => Extraccion) => {
    const nueva = fn(extraccionRef.current!)
    extraccionRef.current = nueva
    setExtraccion(nueva)
  }
  const actualizarCiudad = (id: string, fn: (c: ExtraccionCiudad) => ExtraccionCiudad) =>
    actualizarExtraccion((e) => ({ ...e, ciudades: e.ciudades.map((c) => (c.ciudad.id === id ? fn(c) : c)) }))

  /** Descarga (o vuelve a descargar) una ciudad. Sustituye su resultado: un reintento nunca duplica datos. */
  async function descargar(id: string) {
    const ciudad = buscarCiudad(id)!
    const { inicio: ini, fin: f } = extraccionRef.current!
    actualizarCiudad(id, (c) => ({ ...c, estado: "en_curso", error: undefined, intentos: c.intentos + 1 }))
    const r = await descargarCiudad(ciudad, ini, f)
    actualizarCiudad(id, (c) =>
      r.ok
        ? { ...c, estado: "completada", json: r.json, estadoHttp: r.estadoHttp, duracionMs: r.duracionMs, descargadoEn: new Date().toISOString(), error: undefined }
        : { ...c, estado: "error", json: undefined, estadoHttp: r.estadoHttp, duracionMs: r.duracionMs, error: r.error }
    )
  }

  async function extraer() {
    if (extrayendo || cargandoRef.current) return
    const elegidas = CIUDADES.filter((c) => ciudadesSel.includes(c.id))
    const nueva: Extraccion = {
      inicio,
      fin,
      terminada: false,
      ciudades: elegidas.map((c) => ({ ciudad: c, url: construirUrl(c, inicio, fin), estado: "pendiente", intentos: 0 })),
    }
    extraccionRef.current = nueva
    setExtraccion(nueva)
    setFiltros(filtrosIniciales(elegidas.map((c) => c.nombre)))
    setOrden(ORDEN_INICIAL)
    setSeleccion(new Set())
    setCarga(null)
    setPestana("json")
    setExtrayendo(true)
    // Secuencial: así se ve qué ciudad se está procesando y cuáles quedan pendientes.
    for (const c of elegidas) await descargar(c.id)
    actualizarExtraccion((e) => ({ ...e, terminada: true }))
    setExtrayendo(false)
  }

  async function reintentarCiudad(id: string) {
    if (extrayendo) return
    setExtrayendo(true)
    await descargar(id)
    setExtrayendo(false)
  }

  // ── Transformación + limpieza: se recalculan a partir de las respuestas descargadas ──
  const procesado = React.useMemo(() => {
    if (!extraccion?.terminada) return null
    return procesarRespuestas(
      extraccion.ciudades
        .filter((c) => c.estado === "completada")
        .map((c) => ({ id: c.ciudad.id, nombre: c.ciudad.nombre, json: c.json }))
    )
  }, [extraccion])

  const validos = React.useMemo(() => procesado?.limpieza.validos ?? [], [procesado])
  const resultado = React.useMemo(
    () => calcularSeleccion(validos, filtros, orden, seleccion),
    [validos, filtros, orden, seleccion]
  )
  const huellaActual = React.useMemo(() => huellaFilas(resultado.paraCargar.map(aFilaCarga)), [resultado.paraCargar])

  // ── Carga ─────────────────────────────────────────────────────
  async function ejecutarCarga(base: Carga) {
    cargandoRef.current = true
    setCarga({ ...base, enCurso: true, verificacion: undefined })
    const t0 = performance.now()
    const lotes = await ejecutarLotes(base.lotes, enviarLote, (l) => setCarga((c) => c && { ...c, lotes: l }))
    setCarga((c) => c && { ...c, lotes, verificacion: { estado: "en_curso", comprobadas: 0, encontradas: 0, faltantes: [] } })
    const v = await verificarLotes(lotes)
    setCarga((c) =>
      c && {
        ...c,
        lotes,
        enCurso: false,
        duracionMs: performance.now() - t0,
        verificacion: { ...v, estado: v.error ? "error" : "completada" },
      }
    )
    cargandoRef.current = false
    setVersionDestino((n) => n + 1)
  }

  function subir() {
    if (cargandoRef.current) return
    // Copia congelada del conjunto y su orden: cambios posteriores de filtros no la alteran.
    const filas = resultado.paraCargar.map(aFilaCarga)
    if (filas.length === 0) return
    void ejecutarCarga({ filas, huella: huellaFilas(filas), lotes: crearLotes(filas), enCurso: true })
  }

  function reintentarFallidos() {
    if (cargandoRef.current || !carga) return
    void ejecutarCarga(carga)
  }

  function inspeccionar(destino: PestanaInspeccion | { ancla: string }) {
    if (typeof destino === "string") setPestana(destino)
    const id = typeof destino === "string" ? "inspeccion" : destino.ancla
    requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" }))
  }

  // ── Estado de cada fase ───────────────────────────────────────
  const ciudades = extraccion?.ciudades ?? []
  const conError = ciudades.filter((c) => c.estado === "error")
  const completadas = ciudades.filter((c) => c.estado === "completada")
  const resumenCarga = carga ? resumenLotes(carga.lotes) : null
  const limpieza = procesado?.limpieza

  const fases: Fase[] = [
    {
      id: "extraccion",
      titulo: "Extracción",
      estado: !extraccion ? "pendiente" : extrayendo ? "en_curso" : conError.length ? "error" : "completada",
      explicacion: "Una petición HTTP por ciudad a la API histórica de Open-Meteo; se guarda el JSON original sin tocar.",
      entrada: { valor: extraccion ? ciudades.length : null, etiqueta: "Peticiones" },
      salida: { valor: extraccion ? completadas.reduce((s, c) => s + horasRecibidas(c), 0) : null, etiqueta: "Horas recibidas" },
      nota: conError.length ? `${conError.length} con error: puedes reintentarlas abajo.` : undefined,
      duracionMs: ciudades.some((c) => c.duracionMs !== undefined) ? ciudades.reduce((s, c) => s + (c.duracionMs ?? 0), 0) : undefined,
      inspeccionar: { pestana: "json", texto: "Ver JSON" },
    },
    {
      id: "transformacion",
      titulo: "Transformación",
      estado: !procesado ? "pendiente" : procesado.incidencias.length ? "error" : "completada",
      explicacion: "Convierte los arrays paralelos de «hourly» en un registro por ciudad y hora, con la hora interpretada en UTC.",
      entrada: { valor: procesado ? completadas.length : null, etiqueta: "Respuestas JSON" },
      salida: { valor: procesado?.transformados.length ?? null, etiqueta: "Registros" },
      nota: procesado?.incidencias.length ? `${procesado.incidencias.length} incidencias estructurales.` : undefined,
      duracionMs: procesado?.msTransformacion,
      inspeccionar: { pestana: "transformados", texto: "Ver registros" },
    },
    {
      id: "limpieza",
      titulo: "Limpieza",
      estado: !limpieza ? "pendiente" : "completada",
      explicacion: "Rechaza nulos, ausentes, tipos no numéricos y valores fuera de rango, y elimina duplicados por ciudad y hora.",
      entrada: { valor: procesado?.transformados.length ?? null, etiqueta: "Transformados" },
      salida: { valor: limpieza?.validos.length ?? null, etiqueta: "Válidos" },
      nota: limpieza
        ? `${formatoEntero(limpieza.rechazados.length)} rechazados (${formatoEntero(limpieza.rechazadosCalidad)} calidad, ${formatoEntero(limpieza.duplicados)} duplicados).`
        : undefined,
      duracionMs: procesado?.msLimpieza,
      inspeccionar: { pestana: "rechazados", texto: "Ver rechazados" },
    },
    {
      id: "seleccion",
      titulo: "Filtrado y selección",
      estado: !limpieza || resultado.paraCargar.length === 0 ? "pendiente" : "completada",
      explicacion: "Filtra los válidos, los ordena y deja que elijas qué filas exactas se subirán.",
      entrada: { valor: limpieza ? validos.length : null, etiqueta: "Válidos" },
      salida: { valor: limpieza ? resultado.paraCargar.length : null, etiqueta: "Para cargar" },
      nota: limpieza
        ? `${formatoEntero(resultado.coincidentes.length)} coinciden con los filtros${resultado.seleccionadosFueraDeFiltro ? ` · ${formatoEntero(resultado.seleccionadosFueraDeFiltro)} seleccionadas fuera de filtro` : ""}.`
        : undefined,
      duracionMs: limpieza ? resultado.duracionMs : undefined,
      inspeccionar: { ancla: "seleccion", texto: "Ir a la selección" },
    },
    {
      id: "carga",
      titulo: "Carga",
      estado: !carga
        ? "pendiente"
        : carga.enCurso
          ? "en_curso"
          : resumenCarga!.fallidos > 0 || carga.verificacion?.estado === "error" || !!carga.verificacion?.faltantes.length
            ? "error"
            : "completada",
      explicacion: "Envía la copia congelada en lotes de 500 al servidor, que hace un upsert en Supabase y después verifica las claves.",
      entrada: { valor: carga ? carga.filas.length : null, etiqueta: "Congeladas" },
      salida: { valor: resumenCarga ? resumenCarga.filasCorrectas : null, etiqueta: "Cargadas" },
      nota: resumenCarga?.fallidos ? `${resumenCarga.fallidos} lotes fallidos.` : undefined,
      duracionMs: carga?.duracionMs,
      inspeccionar: { pestana: "supabase", texto: "Ver destino" },
    },
  ]

  const ocupado = extrayendo
    ? "Extracción en curso…"
    : carga?.enCurso
      ? "Hay una carga en curso: espera a que termine para extraer de nuevo."
      : null

  return (
    <div className="grid gap-6 lg:grid-cols-4">
      {/* Columna del mapa: primero en móvil y fija al hacer scroll en escritorio. */}
      <aside className="min-w-0 lg:sticky lg:top-6 lg:self-start">
        <PanelMapa ciudadesSel={ciudadesSel} activa={ciudadActiva} alSeleccionar={setCiudadActiva} validos={validos} />
      </aside>

      <div className="grid min-w-0 gap-6 lg:col-span-3">
        <SeccionConfiguracion
          ciudades={ciudadesSel}
          alCambiarCiudades={setCiudadesSel}
          inicio={inicio}
          fin={fin}
          alCambiarInicio={setInicio}
          alCambiarFin={setFin}
          validacion={validacion}
          hoy={hoy}
          ocupado={ocupado}
          hayResultados={!!extraccion}
          alExtraer={() => void extraer()}
        />

        <SeccionPipeline
          fases={fases}
          ciudades={ciudades}
          extrayendo={extrayendo}
          alInspeccionar={inspeccionar}
          alReintentar={(id) => void reintentarCiudad(id)}
        />

        <Contadores
          v={{
            extraidos: procesado?.transformados.length ?? 0,
            validos: validos.length,
            rechazados: limpieza?.rechazados.length ?? 0,
            rechazadosCalidad: limpieza?.rechazadosCalidad ?? 0,
            duplicados: limpieza?.duplicados ?? 0,
            coinciden: resultado.coincidentes.length,
            seleccionados: resultado.paraCargar.length,
          }}
        />

        <SeccionSeleccion
          ciudadesDisponibles={ciudades.map((c) => c.ciudad.nombre)}
          totalValidos={validos.length}
          filtros={filtros}
          alCambiarFiltros={setFiltros}
          orden={orden}
          alCambiarOrden={setOrden}
          resultado={resultado}
          seleccion={seleccion}
          alCambiarSeleccion={setSeleccion}
          alRestablecer={() => {
            setFiltros(filtrosIniciales(ciudades.map((c) => c.ciudad.nombre)))
            setOrden(ORDEN_INICIAL)
          }}
          cargaEnCurso={!!carga?.enCurso}
        />

        <SeccionInspeccion
          pestana={pestana}
          alCambiarPestana={setPestana}
          ciudades={ciudades}
          ciudadActiva={ciudadActiva}
          alCambiarCiudad={setCiudadActiva}
          inicio={extraccion?.inicio ?? inicio}
          fin={extraccion?.fin ?? fin}
          procesado={procesado}
          paraCargar={resultado.paraCargar}
          huella={huellaActual}
          versionDestino={versionDestino}
        />

        <SeccionCarga
          integracion={integracion}
          totalParaCargar={resultado.paraCargar.length}
          huellaActual={huellaActual}
          carga={carga}
          alSubir={subir}
          alReintentarFallidos={reintentarFallidos}
          alVerDestino={() => inspeccionar("supabase")}
        />
      </div>
    </div>
  )
}
