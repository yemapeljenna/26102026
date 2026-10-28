"use client"

import * as React from "react"
import { Download, Info, ScanSearch } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { aFilaCarga, type Medicion, type RegistroRechazado, type RegistroTransformado } from "@/lib/etl/tipos"
import { formatoDuracion, formatoEntero } from "@/lib/etl/formato"
import type { ResultadoProcesado } from "@/lib/etl/pipeline"
import { cn } from "@/lib/utils"
import { CabeceraTarjeta } from "./cabecera-tarjeta"
import { columnasMedicion, FechaUtc, ValorBruto } from "./celdas"
import { DatosSupabase } from "./datos-supabase"
import { DetallesTecnicos } from "./detalles-tecnicos"
import { EstadoVacio } from "./estado-vacio"
import { TablaPaginada, type Columna } from "./tabla-paginada"
import type { ExtraccionCiudad, PestanaInspeccion } from "./tipos-sesion"

const MAX_ELEMENTOS_VISTA = 48

/** JSON legible: arrays de valores simples en una línea y recortados (la descarga es completa). */
function jsonCompacto(v: unknown, nivel = 0): string {
  const sangria = "  ".repeat(nivel + 1)
  const cierre = "  ".repeat(nivel)
  if (Array.isArray(v)) {
    const simples = v.every((x) => x === null || typeof x !== "object")
    if (simples) {
      const visibles = v.slice(0, MAX_ELEMENTOS_VISTA).map((x) => JSON.stringify(x) ?? "undefined")
      const resto = v.length - visibles.length
      return `[${visibles.join(", ")}${resto > 0 ? `, … (+${resto} elementos; ${v.length} en total)` : ""}]`
    }
    return `[\n${v.map((x) => sangria + jsonCompacto(x, nivel + 1)).join(",\n")}\n${cierre}]`
  }
  if (v && typeof v === "object") {
    const pares = Object.entries(v).map(([k, x]) => `${sangria}${JSON.stringify(k)}: ${jsonCompacto(x, nivel + 1)}`)
    return `{\n${pares.join(",\n")}\n${cierre}}`
  }
  return JSON.stringify(v) ?? "undefined"
}

function descargar(nombre: string, datos: unknown) {
  const blob = new Blob([JSON.stringify(datos, null, 2)], { type: "application/json" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = nombre
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function JsonOriginal({
  ciudades,
  ciudadActiva,
  alCambiarCiudad,
  inicio,
  fin,
}: {
  ciudades: ExtraccionCiudad[]
  ciudadActiva: string
  alCambiarCiudad: (id: string) => void
  inicio: string
  fin: string
}) {
  const conJson = ciudades.filter((c) => c.json !== undefined)
  // Si la ciudad activa no tiene JSON (no extraída o con error), se muestra la primera disponible.
  const actual = conJson.find((c) => c.ciudad.id === ciudadActiva) ?? conJson[0]

  if (!actual) {
    return <EstadoVacio icono={Download}>Aún no hay datos descargados.</EstadoVacio>
  }
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Ciudad" className="flex flex-wrap gap-1">
          {conJson.map((c) => (
            <button key={c.ciudad.id} type="button" aria-pressed={c === actual} onClick={() => alCambiarCiudad(c.ciudad.id)} className="rounded-full px-3 py-1.5 text-xs font-medium transition-colors duration-150 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 aria-pressed:bg-primary aria-pressed:text-primary-foreground not-aria-pressed:text-muted-foreground not-aria-pressed:hover:text-foreground">
              {c.ciudad.nombre}
            </button>
          ))}
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => descargar(`open-meteo_${actual.ciudad.id}_${inicio}_${fin}.json`, actual.json)}>
            <Download />
            Descargar {actual.ciudad.nombre}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              descargar(
                `open-meteo_todas_${inicio}_${fin}.json`,
                Object.fromEntries(conJson.map((c) => [c.ciudad.nombre, { url: c.url, descargado_en: c.descargadoEn, respuesta: c.json }]))
              )
            }
          >
            <Download />
            Descargar todas
          </Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">Vista recortada. La descarga trae el JSON completo.</p>
      <DetallesTecnicos>
        <dl className="grid gap-1 sm:grid-cols-[auto_1fr] sm:gap-x-3">
          <dt>Petición</dt>
          <dd className="font-mono break-all text-foreground">{actual.url}</dd>
          <dt>Respuesta</dt>
          <dd className="tabular-nums">
            HTTP {actual.estadoHttp} · {formatoDuracion(actual.duracionMs)} · descargada {actual.descargadoEn?.replace("T", " ").slice(0, 19)} UTC
          </dd>
        </dl>
        <p>
          Los arrays se recortan a <span className="tabular-nums">{MAX_ELEMENTOS_VISTA}</span> elementos. <code>hourly</code> trae arrays paralelos: la
          posición <em>i</em> de cada uno corresponde a la hora <code>time[i]</code>.
        </p>
      </DetallesTecnicos>
      <pre className="max-h-[28rem] overflow-auto rounded-lg bg-codigo p-3 font-mono text-xs leading-relaxed text-foreground whitespace-pre-wrap">
        {jsonCompacto(actual.json)}
      </pre>
    </div>
  )
}

const columnasTransformados: Columna<RegistroTransformado>[] = [
  { id: "ciudad", encabezado: "Ciudad", celda: (r) => r.ciudad },
  { id: "indice", encabezado: "Posición", numerica: true, celda: (r) => r.indice },
  { id: "origen", encabezado: "Hora recibida", celda: (r) => <ValorBruto valor={r.fecha_hora_origen} /> },
  {
    id: "fecha_hora",
    encabezado: "Hora",
    unidad: "UTC",
    celda: (r) => (r.fecha_hora ? <FechaUtc iso={r.fecha_hora} /> : <ValorBruto valor={null} />),
  },
  { id: "t", encabezado: "Temperatura", unidad: "°C", numerica: true, celda: (r) => <ValorBruto valor={r.temperatura_c} /> },
  { id: "h", encabezado: "Humedad", unidad: "%", numerica: true, celda: (r) => <ValorBruto valor={r.humedad_pct} /> },
  { id: "p", encabezado: "Precipitación", unidad: "mm", numerica: true, celda: (r) => <ValorBruto valor={r.precipitacion_mm} /> },
]

const columnasRechazados: Columna<RegistroRechazado>[] = [
  { id: "ciudad", encabezado: "Ciudad", celda: (r) => r.registro.ciudad },
  { id: "indice", encabezado: "Posición", numerica: true, celda: (r) => r.registro.indice },
  { id: "origen", encabezado: "Hora recibida", celda: (r) => <ValorBruto valor={r.registro.fecha_hora_origen} /> },
  { id: "t", encabezado: "Temperatura", unidad: "°C", numerica: true, celda: (r) => <ValorBruto valor={r.registro.temperatura_c} /> },
  { id: "h", encabezado: "Humedad", unidad: "%", numerica: true, celda: (r) => <ValorBruto valor={r.registro.humedad_pct} /> },
  { id: "p", encabezado: "Precipitación", unidad: "mm", numerica: true, celda: (r) => <ValorBruto valor={r.registro.precipitacion_mm} /> },
  {
    id: "tipo",
    encabezado: "Tipo",
    celda: (r) => <Badge variant={r.tipo === "duplicado" ? "secondary" : "destructive"}>{r.tipo === "duplicado" ? "Repetido" : "No válido"}</Badge>,
  },
  {
    id: "motivo",
    encabezado: "Motivo",
    className: "min-w-64 whitespace-normal",
    celda: (r) => (
      <ul className="text-xs">
        {r.motivos.map((m) => <li key={m}>{m}</li>)}
      </ul>
    ),
  },
]

function Rechazados({ rechazados }: { rechazados: RegistroRechazado[] }) {
  const [tipo, setTipo] = React.useState<"todos" | "calidad" | "duplicado">("todos")
  const filas = tipo === "todos" ? rechazados : rechazados.filter((r) => r.tipo === tipo)
  const n = (t: string) => rechazados.filter((r) => r.tipo === t).length
  return (
    <div className="grid gap-3">
      <p className="text-xs text-muted-foreground">
        Solo lo que quitó la limpieza. Lo que excluyen tus filtros no cuenta aquí.
      </p>
      <div role="group" aria-label="Tipo de rechazo" className="flex flex-wrap gap-1">
        {([
          ["todos", `Todos (${formatoEntero(rechazados.length)})`],
          ["calidad", `No válidos (${formatoEntero(n("calidad"))})`],
          ["duplicado", `Repetidos (${formatoEntero(n("duplicado"))})`],
        ] as const).map(([v, t]) => (
          <button key={v} type="button" aria-pressed={tipo === v} onClick={() => setTipo(v)} className="rounded-full px-3 py-1.5 text-xs font-medium transition-colors duration-150 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 aria-pressed:bg-primary aria-pressed:text-primary-foreground not-aria-pressed:text-muted-foreground not-aria-pressed:hover:text-foreground">
            {t}
          </button>
        ))}
      </div>
      <TablaPaginada
        key={tipo}
        etiqueta="Registros descartados y motivo"
        filas={filas}
        columnas={columnasRechazados}
        claveFila={(r) => r.registro.id}
        vacio="No hay descartados de este tipo."
      />
    </div>
  )
}

function VistaPrevia({ paraCargar, huella }: { paraCargar: Medicion[]; huella: string }) {
  const ejemplo = paraCargar.slice(0, 3).map(aFilaCarga)
  const columnas: Columna<Medicion>[] = [
    { id: "n", encabezado: "Nº", numerica: true, celda: (_m, i) => formatoEntero(i + 1) },
    ...columnasMedicion(),
  ]
  return (
    <div className="grid gap-3">
      <p className="text-sm">
        <strong className="text-lg tabular-nums">{formatoEntero(paraCargar.length)}</strong> registros, en este orden.
      </p>
      <TablaPaginada
        etiqueta="Vista previa de la carga"
        filas={paraCargar}
        columnas={columnas}
        claveFila={(m) => m.clave}
        vacio="No hay nada que guardar con los filtros actuales."
      />
      <DetallesTecnicos>
        <p>
          Huella del conjunto: <code className="rounded bg-muted px-1">{huella}</code>. Se envía en lotes de 500. La base de datos no guarda el
          orden de envío: para leer ordenado hace falta <code>ORDER BY</code> (por ejemplo, <code>ORDER BY ciudad, fecha_hora</code>).
        </p>
        {ejemplo.length > 0 && (
          <>
            <p>Primeras filas tal como se envían al servidor:</p>
            <pre className="max-h-[28rem] overflow-auto rounded-lg bg-codigo p-3 font-mono text-foreground">{JSON.stringify({ filas: ejemplo }, null, 2)}</pre>
          </>
        )}
      </DetallesTecnicos>
    </div>
  )
}

export function SeccionInspeccion({
  pestana,
  alCambiarPestana,
  ciudades,
  ciudadActiva,
  alCambiarCiudad,
  inicio,
  fin,
  procesado,
  paraCargar,
  huella,
  versionDestino,
}: {
  pestana: PestanaInspeccion
  alCambiarPestana: (p: PestanaInspeccion) => void
  ciudades: ExtraccionCiudad[]
  ciudadActiva: string
  alCambiarCiudad: (id: string) => void
  inicio: string
  fin: string
  procesado: ResultadoProcesado | null
  paraCargar: Medicion[]
  huella: string
  versionDestino: number
}) {
  const sinDatos = <EstadoVacio icono={ScanSearch}>Extrae datos para ver esta fase.</EstadoVacio>
  const pestanas: { valor: PestanaInspeccion; texto: string; n?: number }[] = [
    { valor: "json", texto: "Originales", n: ciudades.filter((c) => c.json !== undefined).length },
    { valor: "transformados", texto: "Transformados", n: procesado?.transformados.length },
    { valor: "validos", texto: "Válidos", n: procesado?.limpieza.validos.length },
    { valor: "rechazados", texto: "Descartados", n: procesado?.limpieza.rechazados.length },
    { valor: "vista-previa", texto: "Lo que se guardará", n: paraCargar.length },
    { valor: "supabase", texto: "En Supabase" },
  ]

  return (
    <Card id="inspeccion">
      <CabeceraTarjeta
        titulo="Revisar los datos"
        subtitulo="Todo está en tu navegador hasta que lo guardas."
      />
      <CardContent>
        <Tabs value={pestana} onValueChange={(v) => alCambiarPestana(v as PestanaInspeccion)}>
          <div className="-mx-1 overflow-x-auto px-1 pb-1">
            <TabsList className="w-max">
              {pestanas.map((p) => (
                <TabsTrigger key={p.valor} value={p.valor} className={cn(p.valor === "supabase" && "font-semibold")}>
                  {p.texto}
                  {p.n !== undefined && <span className="text-xs font-normal tabular-nums">({formatoEntero(p.n)})</span>}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <TabsContent value="json" className="pt-3">
            <JsonOriginal ciudades={ciudades} ciudadActiva={ciudadActiva} alCambiarCiudad={alCambiarCiudad} inicio={inicio} fin={fin} />
          </TabsContent>

          <TabsContent value="transformados" className="grid gap-3 pt-3">
            {!procesado ? sinDatos : (
              <>
                <p className="text-xs text-muted-foreground">
                  Una fila por ciudad y hora. Los vacíos se ven tal cual (<ValorBruto valor={null} />, <ValorBruto valor="" />), no como 0.
                </p>
                {procesado.incidencias.length > 0 && (
                  <Alert variant="destructive">
                    <Info />
                    <AlertTitle>Problemas en los datos recibidos</AlertTitle>
                    <AlertDescription>
                      <ul className="list-disc pl-4">
                        {procesado.incidencias.map((i) => <li key={i.ciudad + i.mensaje}>{i.ciudad}: {i.mensaje}</li>)}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}
                <TablaPaginada
                  etiqueta="Registros transformados"
                  filas={procesado.transformados}
                  columnas={columnasTransformados}
                  claveFila={(r) => r.id}
                  vacio="La transformación no produjo registros."
                />
              </>
            )}
          </TabsContent>

          <TabsContent value="validos" className="grid gap-3 pt-3">
            {!procesado ? sinDatos : (
              <>
                <p className="text-xs text-muted-foreground">
                  Lo que pasó la limpieza, sin filtrar.
                </p>
                <TablaPaginada
                  etiqueta="Registros válidos"
                  filas={procesado.limpieza.validos}
                  columnas={columnasMedicion()}
                  claveFila={(m) => m.clave}
                  vacio="Ningún registro superó la limpieza."
                />
              </>
            )}
          </TabsContent>

          <TabsContent value="rechazados" className="pt-3">
            {!procesado ? sinDatos : <Rechazados rechazados={procesado.limpieza.rechazados} />}
          </TabsContent>

          <TabsContent value="vista-previa" className="pt-3">
            {!procesado ? sinDatos : <VistaPrevia paraCargar={paraCargar} huella={huella} />}
          </TabsContent>

          <TabsContent value="supabase" className="pt-3">
            <DatosSupabase version={versionDestino} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
