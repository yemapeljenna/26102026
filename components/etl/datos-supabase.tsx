"use client"

import * as React from "react"
import { CircleAlert, Database, RefreshCw } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { FilaPersistida, RespuestaMediciones } from "@/lib/etl/api-tipos"
import { NOMBRES_CIUDADES } from "@/lib/etl/ciudades"
import { normalizarTimestamp } from "@/lib/etl/fechas"
import { formatoEntero, formatoNumero } from "@/lib/etl/formato"
import { FechaUtc } from "./celdas"
import { EncabezadoColumna, Paginador, TAMANOS_PAGINA } from "./tabla-paginada"

const claseSelect = "h-8 w-full rounded-lg border border-input bg-card px-2 text-sm"

interface Consulta {
  ciudad: string
  desde: string
  hasta: string
  orden: string
  direccion: "asc" | "desc"
  pagina: number
  tamano: number
}

type Estado =
  | { tipo: "inicial" }
  | { tipo: "cargando" }
  | { tipo: "ok"; filas: FilaPersistida[]; total: number; leidoEn: string }
  | { tipo: "error"; mensaje: string }

/** Lectura real de la tabla destino, siempre a través del servidor. */
export function DatosSupabase({ version }: { version: number }) {
  const [consulta, setConsulta] = React.useState<Consulta>({
    ciudad: "",
    desde: "",
    hasta: "",
    orden: "fecha_hora",
    direccion: "asc",
    pagina: 0,
    tamano: TAMANOS_PAGINA[0],
  })
  const [estado, setEstado] = React.useState<Estado>({ tipo: "inicial" })
  const [recarga, setRecarga] = React.useState(0)

  React.useEffect(() => {
    const control = new AbortController()
    const params = new URLSearchParams({
      orden: consulta.orden,
      direccion: consulta.direccion,
      pagina: String(consulta.pagina),
      tamano: String(consulta.tamano),
    })
    if (consulta.ciudad) params.set("ciudad", consulta.ciudad)
    if (consulta.desde) params.set("desde", consulta.desde)
    if (consulta.hasta) params.set("hasta", consulta.hasta)

    fetch(`/api/mediciones?${params}`, { signal: control.signal, cache: "no-store" })
      .then(async (r) => (await r.json()) as RespuestaMediciones)
      .then((r) =>
        setEstado(
          r.ok
            ? { tipo: "ok", filas: r.filas, total: r.total, leidoEn: new Date().toLocaleTimeString("es-ES") }
            : { tipo: "error", mensaje: r.error }
        )
      )
      .catch((e: unknown) => {
        if (!control.signal.aborted) {
          setEstado({ tipo: "error", mensaje: `No se pudo consultar el servidor: ${e instanceof Error ? e.message : e}` })
        }
      })
    return () => control.abort()
  }, [consulta, recarga, version])

  const cambiar = (c: Partial<Consulta>) => {
    setEstado((e) => (e.tipo === "ok" ? e : { tipo: "cargando" }))
    setConsulta((x) => ({ ...x, pagina: 0, ...c }))
  }

  return (
    <div className="grid gap-4">
      <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Database aria-hidden className="size-4 shrink-0 text-primary" />
        Lo que hay guardado ahora mismo en Supabase.
      </p>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[repeat(5,minmax(0,1fr))_auto] xl:items-end">
        <div className="grid gap-1">
          <Label htmlFor="sb-ciudad" className="text-xs">Ciudad</Label>
          <select id="sb-ciudad" className={claseSelect} value={consulta.ciudad} onChange={(e) => cambiar({ ciudad: e.target.value })}>
            <option value="">Todas</option>
            {NOMBRES_CIUDADES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="grid gap-1">
          <Label htmlFor="sb-desde" className="text-xs">Desde (UTC)</Label>
          <Input id="sb-desde" type="date" value={consulta.desde} onChange={(e) => cambiar({ desde: e.target.value })} />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="sb-hasta" className="text-xs">Hasta (UTC, incluida)</Label>
          <Input id="sb-hasta" type="date" value={consulta.hasta} onChange={(e) => cambiar({ hasta: e.target.value })} />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="sb-orden" className="text-xs">Ordenar por (ORDER BY)</Label>
          <select id="sb-orden" className={claseSelect} value={consulta.orden} onChange={(e) => cambiar({ orden: e.target.value })}>
            <option value="ciudad">Ciudad</option>
            <option value="fecha_hora">Fecha y hora</option>
            <option value="temperatura_c">Temperatura</option>
            <option value="humedad_pct">Humedad</option>
            <option value="precipitacion_mm">Precipitación</option>
            <option value="importado_en">Importado en</option>
          </select>
        </div>
        <div className="grid gap-1">
          <Label htmlFor="sb-dir" className="text-xs">Dirección</Label>
          <select id="sb-dir" className={claseSelect} value={consulta.direccion} onChange={(e) => cambiar({ direccion: e.target.value as "asc" | "desc" })}>
            <option value="asc">Ascendente</option>
            <option value="desc">Descendente</option>
          </select>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            setEstado((e) => (e.tipo === "ok" ? e : { tipo: "cargando" }))
            setRecarga((n) => n + 1)
          }}
        >
          <RefreshCw />
          Actualizar
        </Button>
      </div>

      {estado.tipo === "error" && (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>No se pudieron leer los datos de Supabase</AlertTitle>
          <AlertDescription>{estado.mensaje}</AlertDescription>
        </Alert>
      )}
      {(estado.tipo === "inicial" || estado.tipo === "cargando") && (
        <p className="text-sm text-muted-foreground" aria-live="polite">Consultando Supabase…</p>
      )}
      {estado.tipo === "ok" && (
        <div>
          <p className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground" aria-live="polite">
            <Badge variant="outline">Persistido</Badge>
            {formatoEntero(estado.total)} filas en destino con estos filtros · leído a las {estado.leidoEn}
          </p>
          <div className="overflow-hidden rounded-2xl bg-codigo">
            <Table aria-label="Registros almacenados en Supabase" contenedorClassName="max-h-[36rem] overflow-auto">
              <TableHeader className="sticky top-0 z-10 bg-secondary">
                <TableRow>
                  <TableHead scope="col" className="h-auto py-2 text-right"><EncabezadoColumna titulo="id" /></TableHead>
                  <TableHead scope="col" className="h-auto py-2"><EncabezadoColumna titulo="Ciudad" /></TableHead>
                  <TableHead scope="col" className="h-auto py-2"><EncabezadoColumna titulo="Fecha y hora" unidad="UTC" /></TableHead>
                  <TableHead scope="col" className="h-auto py-2 text-right"><EncabezadoColumna titulo="Temperatura" unidad="°C" /></TableHead>
                  <TableHead scope="col" className="h-auto py-2 text-right"><EncabezadoColumna titulo="Humedad relativa" unidad="%" /></TableHead>
                  <TableHead scope="col" className="h-auto py-2 text-right"><EncabezadoColumna titulo="Precipitación" unidad="mm" /></TableHead>
                  <TableHead scope="col" className="h-auto py-2"><EncabezadoColumna titulo="Importado en" unidad="UTC" /></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {estado.filas.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                      No hay filas en Supabase con estos filtros.
                    </TableCell>
                  </TableRow>
                ) : (
                  estado.filas.map((f) => (
                    <TableRow key={f.id}>
                      <TableCell className="text-right tabular-nums text-muted-foreground">{f.id}</TableCell>
                      <TableCell>{f.ciudad}</TableCell>
                      <TableCell><FechaUtc iso={normalizarTimestamp(f.fecha_hora) ?? f.fecha_hora} /></TableCell>
                      <TableCell className="text-right tabular-nums">{formatoNumero(f.temperatura_c)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatoNumero(f.humedad_pct)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatoNumero(f.precipitacion_mm)}</TableCell>
                      <TableCell className="text-xs tabular-nums">{(normalizarTimestamp(f.importado_en) ?? f.importado_en).slice(0, 19).replace("T", " ")}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <Paginador
            pagina={consulta.pagina}
            total={estado.total}
            tamano={consulta.tamano}
            alCambiarPagina={(p) => setConsulta((c) => ({ ...c, pagina: p }))}
            alCambiarTamano={(t) => cambiar({ tamano: t })}
          />
        </div>
      )}
    </div>
  )
}
