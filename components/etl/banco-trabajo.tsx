"use client"

import * as React from "react"

import { resumirPorCiudad } from "@/lib/analisis"
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
import { ActividadPipeline } from "./actividad-pipeline"
import { CabeceraPagina } from "./cabecera-pagina"
import { tipoClima } from "./clima-cabecera"
import { Contadores } from "./contadores"
import { SeccionAnalisis } from "./seccion-analisis"
import { SeccionCarga } from "./seccion-carga"
import { SeccionConfiguracion } from "./seccion-configuracion"
import { SeccionInspeccion } from "./seccion-inspeccion"
import { SeccionMapa } from "./seccion-mapa"
import { SeccionPipeline, type Fase } from "./seccion-pipeline"
import { SeccionSeleccion } from "./seccion-seleccion"
import type { Carga, EventoPipeline, Extraccion, ExtraccionCiudad, PestanaInspeccion } from "./tipos-sesion"

const MAX_EVENTOS = 20

// Solo en desarrollo: las respuestas de Open-Meteo se guardan en sessionStorage (clave = URL) para no gastar el límite al probar
const CACHE_DESARROLLO = process.env.NODE_ENV === "development"
const PREFIJO_CACHE = "open-meteo:"

function enCache(url: string): boolean {
  if (!CACHE_DESARROLLO) return false
  try {
    return sessionStorage.getItem(PREFIJO_CACHE + url) !== null
  } catch {
    return false
  }
}

const fetchConCache: typeof fetch = async (entrada, init) => {
  const clave = PREFIJO_CACHE + String(entrada)
  try {
    const guardada = sessionStorage.getItem(clave)
    if (guardada !== null) return new Response(guardada, { status: 200, headers: { "Content-Type": "application/json" } })
  } catch {
    // Sin sessionStorage: se pide a la API
  }
  const respuesta = await fetch(entrada, init)
  if (respuesta.ok) {
    try {
      sessionStorage.setItem(clave, await respuesta.clone().text())
    } catch {
      // Lleno o no disponible: no se guarda
    }
  }
  return respuesta
}

/** Error de descarga en español y en una línea (el 429 se avisa aparte, una sola vez). */
function mensajeError(r: { error: string; estadoHttp?: number }): string {
  const s = r.estadoHttp
  if (s === undefined) return r.error
  if (s < 400) return "Open-Meteo devolvió una respuesta que no se puede leer."
  if (s === 400) return "Open-Meteo no acepta esta petición. Revisa las fechas."
  if (s >= 500) return "Open-Meteo no responde ahora mismo. Prueba más tarde."
  return `Open-Meteo devolvió un error (${s}).`
}

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
  // Open-Meteo respondió 429: se detiene la descarga y se muestra un único aviso
  const [limitado, setLimitado] = React.useState(false)

  // ── Filtrado y selección ───────────────────────────────────────
  const [filtros, setFiltros] = React.useState<Filtros>(() => filtrosIniciales([]))
  const [orden, setOrden] = React.useState<Orden>(ORDEN_INICIAL)
  const [seleccion, setSeleccion] = React.useState<Set<string>>(() => new Set())
  // Por defecto se sube todo lo que coincide con los filtros; la selección a mano es opcional
  const [manual, setManual] = React.useState(false)

  // ── Carga ──────────────────────────────────────────────────────
  const [carga, setCarga] = React.useState<Carga | null>(null)
  const cargandoRef = React.useRef(false)
  const [integracion, setIntegracion] = React.useState<EstadoIntegracion | null>(null)
  const [versionDestino, setVersionDestino] = React.useState(0)
  const [pestana, setPestana] = React.useState<PestanaInspeccion>("json")

  // ── Aparición de las secciones la primera vez que entran en pantalla ──
  React.useEffect(() => {
    const secciones = [...document.querySelectorAll<HTMLElement>("[data-aparecer]")]
    // Lo que ya se ve al cargar se marca antes de activar el efecto: así no parpadea
    for (const el of secciones) if (el.getBoundingClientRect().top < window.innerHeight) el.dataset.visible = ""
    document.documentElement.dataset.aparicion = ""
    const observador = new IntersectionObserver(
      (entradas) => {
        for (const e of entradas) {
          if (!e.isIntersecting) continue
          const el = e.target as HTMLElement
          el.dataset.visible = ""
          observador.unobserve(el)
        }
      },
      { rootMargin: "0px 0px -10% 0px" }
    )
    for (const el of secciones) if (!("visible" in el.dataset)) observador.observe(el)
    return () => observador.disconnect()
  }, [])

  // ── Actividad: eventos del ETL, los más recientes primero ──────
  const [eventos, setEventos] = React.useState<EventoPipeline[]>([])
  const idEvento = React.useRef(0)
  const registrar = React.useCallback(
    (e: Omit<EventoPipeline, "id" | "hora">) =>
      setEventos((prev) => [{ ...e, id: ++idEvento.current, hora: Date.now() }, ...prev].slice(0, MAX_EVENTOS)),
    []
  )

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

  /**
   * Descarga (o vuelve a descargar) una ciudad. Sustituye su resultado: un reintento nunca duplica datos.
   * Devuelve false si Open-Meteo ha limitado las peticiones (429): entonces no tiene sentido seguir.
   */
  async function descargar(id: string): Promise<boolean> {
    const ciudad = buscarCiudad(id)!
    const { inicio: ini, fin: f } = extraccionRef.current!
    const desdeCache = enCache(construirUrl(ciudad, ini, f))
    actualizarCiudad(id, (c) => ({ ...c, estado: "en_curso", error: undefined, intentos: c.intentos + 1 }))
    const r = await descargarCiudad(ciudad, ini, f, CACHE_DESARROLLO ? fetchConCache : undefined)
    if (!r.ok && r.estadoHttp === 429) {
      // La ciudad queda en espera, sin error propio: el aviso es único
      actualizarCiudad(id, (c) => ({ ...c, estado: "pendiente" }))
      setLimitado(true)
      registrar({ tipo: "error", texto: "Open-Meteo ha limitado las peticiones", detalle: "HTTP 429" })
      return false
    }
    const http = r.estadoHttp ? `HTTP ${r.estadoHttp}` : "Sin respuesta"
    registrar(
      r.ok
        ? { tipo: "peticion", texto: `${ciudad.nombre} descargada`, detalle: desdeCache ? "desde caché" : `${http} · ${Math.round(r.duracionMs)} ms` }
        : { tipo: "error", texto: `${ciudad.nombre}: no se pudo descargar`, detalle: mensajeError(r) }
    )
    actualizarCiudad(id, (c) =>
      r.ok
        ? { ...c, estado: "completada", json: r.json, estadoHttp: r.estadoHttp, duracionMs: r.duracionMs, descargadoEn: new Date().toISOString(), error: undefined, desdeCache }
        : { ...c, estado: "error", json: undefined, estadoHttp: r.estadoHttp, duracionMs: r.duracionMs, error: mensajeError(r), desdeCache: false }
    )
    return true
  }

  /** Descarga en orden las ciudades indicadas; se detiene ante un 429. */
  async function descargarVarias(ids: string[]) {
    setLimitado(false)
    for (const id of ids) if (!(await descargar(id))) break
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
    setManual(false)
    setCarga(null)
    setPestana("json")
    setExtrayendo(true)
    setLimitado(false)
    registrar({ tipo: "inicio", texto: "Descarga iniciada", detalle: `${elegidas.length} ciudades · ${inicio} → ${fin}` })
    // Secuencial: así se ve qué ciudad se está procesando y cuáles quedan pendientes.
    await descargarVarias(elegidas.map((c) => c.id))
    const ok = extraccionRef.current!.ciudades.filter((c) => c.estado === "completada").length
    registrar({ tipo: ok === elegidas.length ? "fase" : "error", texto: "Descarga terminada", detalle: `${ok} de ${elegidas.length} ciudades` })
    actualizarExtraccion((e) => ({ ...e, terminada: true }))
    setExtrayendo(false)
  }

  async function reintentarCiudad(id: string) {
    if (extrayendo) return
    setExtrayendo(true)
    await descargarVarias([id])
    setExtrayendo(false)
  }

  /** Botón «Reintentar» del aviso de límite: vuelve a pedir las ciudades que aún no se han descargado. */
  async function reintentarPendientes() {
    if (extrayendo || !extraccionRef.current) return
    setExtrayendo(true)
    await descargarVarias(extraccionRef.current.ciudades.filter((c) => c.estado !== "completada").map((c) => c.ciudad.id))
    setExtrayendo(false)
  }

  // ── Transformación + limpieza: se recalculan a partir de las respuestas descargadas ──
  // Solo si todas las ciudades se descargaron: si la extracción falla, el pipeline se detiene
  const procesado = React.useMemo(() => {
    if (!extraccion?.terminada || extraccion.ciudades.some((c) => c.estado !== "completada")) return null
    return procesarRespuestas(
      extraccion.ciudades
        .filter((c) => c.estado === "completada")
        .map((c) => ({ id: c.ciudad.id, nombre: c.ciudad.nombre, json: c.json }))
    )
  }, [extraccion])

  const validos = React.useMemo(() => procesado?.limpieza.validos ?? [], [procesado])
  const resumenes = React.useMemo(() => resumirPorCiudad(validos), [validos])

  // Fin de la transformación y la limpieza: se recalculan juntas al terminar (o reintentar) la extracción
  React.useEffect(() => {
    if (!procesado) return
    registrar({ tipo: "fase", texto: "Datos ordenados", detalle: `${formatoEntero(procesado.transformados.length)} registros` })
    registrar({
      tipo: "fase",
      texto: "Limpieza terminada",
      detalle: `${formatoEntero(procesado.limpieza.validos.length)} válidos · ${formatoEntero(procesado.limpieza.rechazados.length)} descartados`,
    })
  }, [procesado, registrar])

  // En modo automático todas las claves cuentan como seleccionadas: se sube exactamente lo que coincide
  const todas = React.useMemo(() => new Set(validos.map((m) => m.clave)), [validos])
  const resultado = React.useMemo(() => {
    const r = calcularSeleccion(validos, filtros, orden, manual ? seleccion : todas)
    return manual ? r : { ...r, seleccionadosFueraDeFiltro: 0 }
  }, [validos, filtros, orden, manual, seleccion, todas])

  /** Al pasar a mano se parte de lo que coincide ahora; al volver al modo automático se descarta. */
  function cambiarManual(activo: boolean) {
    setSeleccion(activo ? new Set(resultado.coincidentes.map((m) => m.clave)) : new Set())
    setManual(activo)
  }
  const huellaActual = React.useMemo(() => huellaFilas(resultado.paraCargar.map(aFilaCarga)), [resultado.paraCargar])

  // ── Carga ─────────────────────────────────────────────────────
  async function ejecutarCarga(base: Carga) {
    cargandoRef.current = true
    setCarga({ ...base, enCurso: true, verificacion: undefined })
    const pendientes = base.lotes.filter((l) => l.estado !== "completado")
    registrar({
      tipo: "inicio",
      texto: "Subida iniciada",
      detalle: `${formatoEntero(pendientes.reduce((s, l) => s + l.filas.length, 0))} filas en ${pendientes.length} lotes`,
    })
    // Estado anterior de cada lote, para registrar solo los que acaban de terminar
    const estados = new Map(base.lotes.map((l) => [l.numero, l.estado]))
    const t0 = performance.now()
    const lotes = await ejecutarLotes(base.lotes, enviarLote, (l) => {
      for (const lote of l) {
        if (lote.estado === estados.get(lote.numero)) continue
        estados.set(lote.numero, lote.estado)
        if (lote.estado === "completado")
          registrar({ tipo: "lote", texto: `Lote ${lote.numero} guardado`, detalle: `${formatoEntero(lote.filas.length)} filas · ${lote.duracionMs} ms` })
        else if (lote.estado === "error") registrar({ tipo: "error", texto: `Lote ${lote.numero} con error`, detalle: lote.error })
      }
      setCarga((c) => c && { ...c, lotes: l })
    })
    setCarga((c) => c && { ...c, lotes, verificacion: { estado: "en_curso", comprobadas: 0, encontradas: 0, faltantes: [] } })
    const v = await verificarLotes(lotes)
    registrar(
      v.error
        ? { tipo: "error", texto: "No se pudo comprobar lo guardado", detalle: v.error }
        : { tipo: "fase", texto: "Guardado comprobado", detalle: `${formatoEntero(v.encontradas)} de ${formatoEntero(v.comprobadas)} registros en Supabase` }
    )
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

  function inspeccionar({ pestana: p, ancla = "inspeccion" }: { pestana?: PestanaInspeccion; ancla?: string }) {
    if (p) setPestana(p)
    // Desplazamiento suave salvo que el usuario prefiera menos movimiento
    const suave = !window.matchMedia("(prefers-reduced-motion: reduce)").matches
    requestAnimationFrame(() => document.getElementById(ancla)?.scrollIntoView({ behavior: suave ? "smooth" : "auto", block: "start" }))
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
      estado: !extraccion ? "pendiente" : extrayendo ? "en_curso" : conError.length || limitado || completadas.length < ciudades.length ? "error" : "completada",
      explicacion: "Descarga el tiempo de cada ciudad, hora a hora.",
      entrada: { valor: extraccion ? ciudades.length : null, etiqueta: "Ciudades" },
      salida: { valor: extraccion ? completadas.reduce((s, c) => s + horasRecibidas(c), 0) : null, etiqueta: "Horas recibidas" },
      nota: limitado
        ? "Open-Meteo ha limitado las peticiones."
        : conError.length
          ? `${conError.length} no se pudieron descargar. Puedes reintentarlas abajo.`
          : undefined,
      duracionMs: ciudades.some((c) => c.duracionMs !== undefined) ? ciudades.reduce((s, c) => s + (c.duracionMs ?? 0), 0) : undefined,
      inspeccionar: { pestana: "json", texto: "Ver los datos originales" },
    },
    {
      id: "transformacion",
      titulo: "Transformación",
      estado: !procesado ? "pendiente" : procesado.incidencias.length ? "error" : "completada",
      explicacion: "Ordena los datos en una fila por ciudad y hora.",
      entrada: { valor: procesado ? completadas.length : null, etiqueta: "Ciudades" },
      salida: { valor: procesado?.transformados.length ?? null, etiqueta: "Registros" },
      nota: procesado?.incidencias.length ? `${procesado.incidencias.length} problemas en los datos recibidos.` : undefined,
      duracionMs: procesado?.msTransformacion,
      inspeccionar: { pestana: "transformados", texto: "Ver registros" },
    },
    {
      id: "limpieza",
      titulo: "Limpieza",
      estado: !limpieza ? "pendiente" : "completada",
      explicacion: "Quita valores vacíos, imposibles o repetidos.",
      entrada: { valor: procesado?.transformados.length ?? null, etiqueta: "Registros" },
      salida: { valor: limpieza?.validos.length ?? null, etiqueta: "Válidos" },
      nota: limpieza
        ? `${formatoEntero(limpieza.rechazados.length)} descartados: ${formatoEntero(limpieza.rechazadosCalidad)} no válidos y ${formatoEntero(limpieza.duplicados)} repetidos.`
        : undefined,
      duracionMs: procesado?.msLimpieza,
      inspeccionar: { pestana: "rechazados", texto: "Ver los descartados" },
    },
    {
      id: "seleccion",
      titulo: "Filtrado y selección",
      estado: !limpieza || resultado.paraCargar.length === 0 ? "pendiente" : "completada",
      explicacion: "Elige qué datos guardar. Si no filtras, se guardan todos.",
      entrada: { valor: limpieza ? validos.length : null, etiqueta: "Válidos" },
      salida: { valor: limpieza ? resultado.paraCargar.length : null, etiqueta: "Para guardar" },
      nota: limpieza
        ? `${formatoEntero(resultado.coincidentes.length)} coinciden con los filtros.`
        : undefined,
      duracionMs: limpieza ? resultado.duracionMs : undefined,
      inspeccionar: { ancla: "seleccion", texto: "Ir a los filtros" },
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
      explicacion: "Guarda los datos en Supabase.",
      entrada: { valor: carga ? carga.filas.length : null, etiqueta: "Enviados" },
      salida: { valor: resumenCarga ? resumenCarga.filasCorrectas : null, etiqueta: "Guardados" },
      nota: resumenCarga?.fallidos ? `${formatoEntero(resumenCarga.filasFallidas)} no se pudieron guardar.` : undefined,
      duracionMs: carga?.duracionMs,
      inspeccionar: { pestana: "supabase", texto: "Ver lo guardado" },
    },
  ]

  const ocupado = extrayendo ? "Descargando…" : carga?.enCurso ? "Espera a que termine la subida." : null

  // Partículas de la cabecera según el clima de la ciudad seleccionada
  const resumenActiva = resumenes[buscarCiudad(ciudadActiva)!.nombre]
  const clima = tipoClima(resumenActiva ? { lluvia: resumenActiva.precipitacionTotal, temperatura: resumenActiva.temperaturaMedia } : null)

  // Guía de la cabecera: paso actual y estado de los datos
  const guardado = !!carga && !carga.enCurso && !!resumenCarga && resumenCarga.filasCorrectas > 0 && resumenCarga.fallidos === 0
  const paso = carga ? 3 : procesado ? 2 : 1

  return (
    <div className="grid gap-6">
      <CabeceraPagina paso={paso} estado={guardado ? "guardado" : procesado ? "local" : "sin-datos"} clima={clima} />

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
        limitado={limitado && !extrayendo}
        alReintentar={() => void reintentarPendientes()}
      />

      <SeccionPipeline
        fases={fases}
        ciudades={ciudades}
        extrayendo={extrayendo}
        alInspeccionar={inspeccionar}
        alReintentar={(id) => void reintentarCiudad(id)}
      />

      <Contadores
        datos={procesado}
        v={{
          extraidos: procesado?.transformados.length ?? 0,
          validos: validos.length,
          rechazados: limpieza?.rechazados.length ?? 0,
          coinciden: resultado.coincidentes.length,
          seleccionados: resultado.paraCargar.length,
        }}
      />

      <SeccionMapa activa={ciudadActiva} alSeleccionar={setCiudadActiva} validos={validos} />

      <SeccionAnalisis
        validos={validos}
        activa={ciudadActiva}
        calidad={
          procesado && limpieza
            ? {
                extraidos: procesado.transformados.length,
                validos: validos.length,
                rechazadosCalidad: limpieza.rechazadosCalidad,
                duplicados: limpieza.duplicados,
              }
            : null
        }
      />

      {/* Lo que decides tú antes de guardar */}
      <div className="grid gap-6">
        <SeccionSeleccion
          ciudadesDisponibles={ciudades.map((c) => c.ciudad.nombre)}
          validos={validos}
          filtros={filtros}
          alCambiarFiltros={setFiltros}
          orden={orden}
          alCambiarOrden={setOrden}
          resultado={resultado}
          manual={manual}
          alCambiarManual={cambiarManual}
          seleccion={seleccion}
          alCambiarSeleccion={setSeleccion}
          alQuitarFiltros={() => setFiltros(filtrosIniciales(ciudades.map((c) => c.ciudad.nombre)))}
          cargaEnCurso={!!carga?.enCurso}
        />

        <div data-aparecer className="grid gap-6 lg:grid-cols-4">
          <div className="min-w-0 lg:col-span-3">
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
          </div>
          {/* En escritorio, la actividad ocupa la altura de la inspección y hace scroll interno */}
          <div className="relative min-w-0">
            <ActividadPipeline eventos={eventos} />
          </div>
        </div>

        <SeccionCarga
          integracion={integracion}
          totalParaCargar={resultado.paraCargar.length}
          totalValidos={validos.length}
          totalCoinciden={resultado.coincidentes.length}
          huellaActual={huellaActual}
          carga={carga}
          alSubir={subir}
          alReintentarFallidos={reintentarFallidos}
          alVerDestino={() => inspeccionar({ pestana: "supabase" })}
        />
      </div>
    </div>
  )
}
