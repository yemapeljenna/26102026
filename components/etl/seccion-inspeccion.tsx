"use client"

import * as React from "react"
import { Download, Info } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { aFilaCarga, type Medicion, type RegistroRechazado, type RegistroTransformado } from "@/lib/etl/tipos"
import { formatoDuracion, formatoEntero } from "@/lib/etl/formato"
import type { ResultadoProcesado } from "@/lib/etl/pipeline"
import { cn } from "@/lib/utils"
import { columnasMedicion, FechaUtc, ValorBruto } from "./celdas"
import { DatosSupabase } from "./datos-supabase"
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

function JsonOriginal({ ciudades, inicio, fin }: { ciudades: ExtraccionCiudad[]; inicio: string; fin: string }) {
  const conJson = ciudades.filter((c) => c.json !== undefined)
  const [elegida, setElegida] = React.useState<string | null>(null)
  const actual = conJson.find((c) => c.ciudad.id === elegida) ?? conJson[0]

  if (!actual) {
    return <p className="text-sm text-muted-foreground">Todavía no se ha descargado ninguna respuesta.</p>
  }
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Ciudad" className="flex flex-wrap gap-1">
          {conJson.map((c) => (
            <Button
              key={c.ciudad.id}
              size="sm"
              variant={c === actual ? "default" : "outline"}
              aria-pressed={c === actual}
              onClick={() => setElegida(c.ciudad.id)}
            >
              {c.ciudad.nombre}
            </Button>
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
      <dl className="grid gap-1 text-xs sm:grid-cols-[auto_1fr] sm:gap-x-3">
        <dt className="text-muted-foreground">Petición</dt>
        <dd className="font-mono break-all">{actual.url}</dd>
        <dt className="text-muted-foreground">Respuesta</dt>
        <dd>
          HTTP {actual.estadoHttp} · {formatoDuracion(actual.duracionMs)} · descargada {actual.descargadoEn?.replace("T", " ").slice(0, 19)} UTC
        </dd>
      </dl>
      <p className="text-xs text-muted-foreground">
        Los arrays se muestran recortados a {MAX_ELEMENTOS_VISTA} elementos; la descarga contiene el JSON completo, sin modificar.
        Fíjate en que <code>hourly</code> trae arrays paralelos: la posición <em>i</em> de cada array corresponde a la hora <code>time[i]</code>.
      </p>
      <pre className="max-h-[28rem] overflow-auto rounded-lg border bg-muted/40 p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap">
        {jsonCompacto(actual.json)}
      </pre>
    </div>
  )
}

const columnasTransformados: Columna<RegistroTransformado>[] = [
  { id: "ciudad", encabezado: "Ciudad", celda: (r) => r.ciudad },
  { id: "indice", encabezado: "Posición", unidad: "índice en arrays", numerica: true, celda: (r) => r.indice },
  { id: "origen", encabezado: "time (original)", unidad: "sin zona", celda: (r) => <ValorBruto valor={r.fecha_hora_origen} /> },
  {
    id: "fecha_hora",
    encabezado: "fecha_hora",
    unidad: "interpretada en UTC",
    celda: (r) => (r.fecha_hora ? <FechaUtc iso={r.fecha_hora} /> : <ValorBruto valor={null} />),
  },
  { id: "t", encabezado: "temperatura_c", unidad: "°C", numerica: true, celda: (r) => <ValorBruto valor={r.temperatura_c} /> },
  { id: "h", encabezado: "humedad_pct", unidad: "%", numerica: true, celda: (r) => <ValorBruto valor={r.humedad_pct} /> },
  { id: "p", encabezado: "precipitacion_mm", unidad: "mm", numerica: true, celda: (r) => <ValorBruto valor={r.precipitacion_mm} /> },
]

const columnasRechazados: Columna<RegistroRechazado>[] = [
  { id: "ciudad", encabezado: "Ciudad", celda: (r) => r.registro.ciudad },
  { id: "indice", encabezado: "Posición", numerica: true, celda: (r) => r.registro.indice },
  { id: "origen", encabezado: "time (original)", celda: (r) => <ValorBruto valor={r.registro.fecha_hora_origen} /> },
  { id: "t", encabezado: "Temperatura", unidad: "°C", numerica: true, celda: (r) => <ValorBruto valor={r.registro.temperatura_c} /> },
  { id: "h", encabezado: "Humedad", unidad: "%", numerica: true, celda: (r) => <ValorBruto valor={r.registro.humedad_pct} /> },
  { id: "p", encabezado: "Precipitación", unidad: "mm", numerica: true, celda: (r) => <ValorBruto valor={r.registro.precipitacion_mm} /> },
  {
    id: "tipo",
    encabezado: "Tipo",
    celda: (r) => <Badge variant={r.tipo === "duplicado" ? "secondary" : "destructive"}>{r.tipo === "duplicado" ? "Duplicado" : "Calidad"}</Badge>,
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
        Aquí solo aparecen los descartes de la limpieza. Los registros que excluyen tus filtros siguen siendo válidos y no se cuentan como rechazados.
      </p>
      <div role="group" aria-label="Tipo de rechazo" className="flex flex-wrap gap-1">
        {([
          ["todos", `Todos (${formatoEntero(rechazados.length)})`],
          ["calidad", `Calidad (${formatoEntero(n("calidad"))})`],
          ["duplicado", `Duplicados (${formatoEntero(n("duplicado"))})`],
        ] as const).map(([v, t]) => (
          <Button key={v} size="sm" variant={tipo === v ? "default" : "outline"} aria-pressed={tipo === v} onClick={() => setTipo(v)}>
            {t}
          </Button>
        ))}
      </div>
      <TablaPaginada
        key={tipo}
        etiqueta="Registros rechazados y motivo"
        filas={filas}
        columnas={columnasRechazados}
        claveFila={(r) => r.registro.id}
        vacio="No hay registros rechazados de este tipo."
      />
    </div>
  )
}

function VistaPrevia({ paraCargar, huella }: { paraCargar: Medicion[]; huella: string }) {
  const ejemplo = paraCargar.slice(0, 3).map(aFilaCarga)
  const columnas: Columna<Medicion>[] = [
    { id: "n", encabezado: "Nº envío", numerica: true, celda: (_m, i) => formatoEntero(i + 1) },
    { id: "lote", encabezado: "Lote", numerica: true, celda: (_m, i) => Math.floor(i / 500) + 1 },
    ...columnasMedicion(),
  ]
  return (
    <div className="grid gap-3">
      <p className="text-sm">
        Conjunto exacto que se enviará, en el orden elegido:{" "}
        <strong className="tabular-nums">{formatoEntero(paraCargar.length)}</strong> filas · huella{" "}
        <code className="rounded bg-muted px-1">{huella}</code>
      </p>
      <Alert>
        <Info />
        <AlertTitle>El orden de envío no es el orden en la base de datos</AlertTitle>
        <AlertDescription>
          Una tabla relacional no garantiza que las filas se devuelvan en el orden en que se insertaron. Para leerlas ordenadas, toda consulta
          posterior necesita <code>ORDER BY</code>, por ejemplo <code>ORDER BY ciudad, fecha_hora</code>.
        </AlertDescription>
      </Alert>
      <TablaPaginada
        etiqueta="Vista previa de la carga"
        filas={paraCargar}
        columnas={columnas}
        claveFila={(m) => m.clave}
        vacio="No hay filas seleccionadas que cumplan los filtros: no se enviará nada."
      />
      {ejemplo.length > 0 && (
        <details className="text-xs">
          <summary className="cursor-pointer font-medium">Ver el JSON de las primeras filas tal como se envían al servidor</summary>
          <pre className="mt-2 overflow-auto rounded-lg border bg-muted/40 p-3 font-mono">{JSON.stringify({ filas: ejemplo }, null, 2)}</pre>
        </details>
      )}
    </div>
  )
}

export function SeccionInspeccion({
  pestana,
  alCambiarPestana,
  ciudades,
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
  inicio: string
  fin: string
  procesado: ResultadoProcesado | null
  paraCargar: Medicion[]
  huella: string
  versionDestino: number
}) {
  const sinDatos = <p className="text-sm text-muted-foreground">Extrae datos para ver esta fase.</p>
  const pestanas: { valor: PestanaInspeccion; texto: string; n?: number }[] = [
    { valor: "json", texto: "JSON original", n: ciudades.filter((c) => c.json !== undefined).length },
    { valor: "transformados", texto: "Transformados", n: procesado?.transformados.length },
    { valor: "validos", texto: "Válidos", n: procesado?.limpieza.validos.length },
    { valor: "rechazados", texto: "Rechazados", n: procesado?.limpieza.rechazados.length },
    { valor: "vista-previa", texto: "Vista previa de la carga", n: paraCargar.length },
    { valor: "supabase", texto: "Datos en Supabase" },
  ]

  return (
    <Card id="inspeccion">
      <CardHeader>
        <CardTitle>
          <h2>4. Inspección de datos</h2>
        </CardTitle>
        <CardDescription>
          Resultados de cada fase. Las cinco primeras pestañas son <strong>datos locales</strong> del navegador; la última lee lo que hay realmente en Supabase.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={pestana} onValueChange={(v) => alCambiarPestana(v as PestanaInspeccion)}>
          <div className="-mx-1 overflow-x-auto px-1 pb-1">
            <TabsList className="w-max">
              {pestanas.map((p) => (
                <TabsTrigger key={p.valor} value={p.valor} className={cn(p.valor === "supabase" && "font-semibold")}>
                  {p.texto}
                  {p.n !== undefined && <span className="text-xs text-muted-foreground tabular-nums">({formatoEntero(p.n)})</span>}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <TabsContent value="json" className="pt-3">
            <JsonOriginal ciudades={ciudades} inicio={inicio} fin={fin} />
          </TabsContent>

          <TabsContent value="transformados" className="grid gap-3 pt-3">
            {!procesado ? sinDatos : (
              <>
                <p className="text-xs text-muted-foreground">
                  Un registro por ciudad y hora. Los valores se muestran tal como llegaron: <ValorBruto valor={null} /> o <ValorBruto valor="" /> no se convierten en 0.
                </p>
                {procesado.incidencias.length > 0 && (
                  <Alert variant="destructive">
                    <Info />
                    <AlertTitle>Incidencias estructurales</AlertTitle>
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
                  Registros que superan todas las reglas de limpieza, en el orden de extracción y sin aplicar filtros.
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
