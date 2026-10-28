"use client"

import * as React from "react"
import { Check, CloudUpload, Download, Eraser, ListFilter, RotateCw, Shuffle, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { formatoDuracion, formatoEntero } from "@/lib/etl/formato"
import { cn } from "@/lib/utils"
import { CabeceraTarjeta } from "./cabecera-tarjeta"
import { DetallesTecnicos } from "./detalles-tecnicos"
import { IndicadorEstado, type EstadoFase } from "./indicador-estado"
import type { ExtraccionCiudad, PestanaInspeccion } from "./tipos-sesion"

export interface Fase {
  id: string
  titulo: string
  estado: EstadoFase
  explicacion: string
  entrada: { valor: number | null; etiqueta: string }
  salida: { valor: number | null; etiqueta: string }
  nota?: string
  duracionMs?: number
  /** Pestaña de la inspección que abre y/o sección a la que lleva. */
  inspeccionar?: { pestana?: PestanaInspeccion; ancla?: string; texto: string }
}

type Destino = { pestana?: PestanaInspeccion; ancla?: string }

const ICONOS: Record<string, typeof Download> = {
  extraccion: Download,
  transformacion: Shuffle,
  limpieza: Eraser,
  seleccion: ListFilter,
  carga: CloudUpload,
}

// Aspecto del círculo de cada paso según su estado
const CIRCULO: Record<EstadoFase, string> = {
  pendiente: "border-muted-foreground/40 bg-card text-muted-foreground",
  en_curso: "border-primary bg-card text-primary",
  completada: "border-primary bg-primary text-primary-foreground",
  error: "border-destructive bg-error-suave text-destructive",
}

function Contador({ valor, etiqueta }: { valor: number | null; etiqueta: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{etiqueta}</dt>
      <dd className="text-2xl font-bold tabular-nums">{valor === null ? "—" : formatoEntero(valor)}</dd>
    </div>
  )
}

/** Detalle del paso pulsado: descripción, métricas y enlace a sus datos. */
function DetalleFase({ fase: f, numero, alInspeccionar }: { fase: Fase; numero: number; alInspeccionar: (destino: Destino) => void }) {
  return (
    <div id="detalle-fase" className="grid gap-3 rounded-2xl bg-secondary/50 p-5 sm:grid-cols-[1fr_auto] sm:items-start">
      <div className="grid gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold">
            <span className="text-muted-foreground">{numero}.</span> {f.titulo}
          </h3>
          <IndicadorEstado estado={f.estado} />
        </div>
        <p className="text-sm text-muted-foreground">{f.explicacion}</p>
        {f.nota && <p className="text-sm">{f.nota}</p>}
        <DetallesTecnicos>
          <p className="tabular-nums">Duración medida en el navegador: {formatoDuracion(f.duracionMs)}</p>
        </DetallesTecnicos>
        {f.inspeccionar && (
          <Button variant="link" size="sm" className="w-fit px-0" onClick={() => alInspeccionar(f.inspeccionar!)}>
            {f.inspeccionar.texto}
          </Button>
        )}
      </div>
      <dl className="grid grid-cols-2 gap-6 sm:min-w-56">
        <Contador {...f.entrada} />
        <Contador {...f.salida} />
      </dl>
    </div>
  )
}

export function SeccionPipeline({
  fases,
  ciudades,
  extrayendo,
  alInspeccionar,
  alReintentar,
}: {
  fases: Fase[]
  ciudades: ExtraccionCiudad[]
  extrayendo: boolean
  alInspeccionar: (destino: Destino) => void
  alReintentar: (id: string) => void
}) {
  const [abierta, setAbierta] = React.useState<number | null>(null)
  const procesadas = ciudades.filter((c) => c.estado === "completada" || c.estado === "error")
  const pendientes = ciudades.filter((c) => c.estado === "pendiente" || c.estado === "en_curso")

  return (
    <Card id="pipeline" data-aparecer>
      <CabeceraTarjeta titulo="Pipeline ETL" subtitulo="Pulsa un paso para ver su detalle." />
      <CardContent className="grid gap-5">
        <div className="grid gap-3">
          {/* Agrupación de los pasos: los tres primeros ocurren solos al extraer */}
          <div aria-hidden className="grid grid-cols-5 gap-2 text-center text-xs text-muted-foreground">
            <span className="col-span-3 border-b border-dashed pb-1">Automático</span>
            <span className="col-span-2 border-b border-dashed pb-1">Tú decides</span>
          </div>

          {/* Stepper: la línea hacia el siguiente paso se rellena cuando el paso está completado */}
          <ol className="grid grid-cols-5 gap-2" aria-label="Fases del pipeline">
            {fases.map((f, i) => {
              const Icono = f.estado === "completada" ? Check : f.estado === "error" ? X : ICONOS[f.id]
              return (
                <li key={f.id} className="relative grid justify-items-center gap-1.5 text-center">
                  {i < fases.length - 1 && (
                    <span aria-hidden className="absolute top-5 left-1/2 h-0.5 sm:top-[21px] w-[calc(100%+0.5rem)] bg-border">
                      <span
                        className="block h-full bg-primary transition-[width] duration-300"
                        style={{ width: f.estado === "completada" ? "100%" : "0%" }}
                      />
                    </span>
                  )}
                  <button
                    type="button"
                    aria-expanded={abierta === i}
                    aria-controls={abierta === i ? "detalle-fase" : undefined}
                    aria-label={`Paso ${i + 1}: ${f.titulo}`}
                    title={f.duracionMs === undefined ? undefined : `Duración: ${formatoDuracion(f.duracionMs)}`}
                    onClick={() => setAbierta(abierta === i ? null : i)}
                    className={cn(
                      "relative z-10 grid size-10 place-items-center rounded-full border-2 transition-colors duration-200 outline-none hover:scale-105 focus-visible:ring-3 focus-visible:ring-ring/50 sm:size-11",
                      CIRCULO[f.estado],
                      abierta === i && "ring-3 ring-ring/40"
                    )}
                  >
                    {/* Pulso suave mientras la fase está en curso */}
                    {f.estado === "en_curso" && <span aria-hidden className="absolute -inset-1 rounded-full bg-primary/20 motion-safe:animate-pulse" />}
                    <Icono aria-hidden className="relative size-5" />
                  </button>
                  <span className="text-xs leading-tight font-medium break-words hyphens-auto" lang="es">
                    {f.titulo}
                  </span>
                  <span className="text-base font-bold tabular-nums">{f.salida.valor === null ? "—" : formatoEntero(f.salida.valor)}</span>
                </li>
              )
            })}
          </ol>
        </div>

        {abierta !== null && <DetalleFase fase={fases[abierta]} numero={abierta + 1} alInspeccionar={alInspeccionar} />}

        {ciudades.length > 0 && (
          <section aria-labelledby="titulo-peticiones">
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
              <h3 id="titulo-peticiones" className="text-sm font-semibold">
                Descarga por ciudad
              </h3>
              <p className="text-xs text-muted-foreground" aria-live="polite">
                {extrayendo
                  ? `${procesadas.length} de ${ciudades.length} · faltan ${pendientes.map((c) => c.ciudad.nombre).join(", ") || "ninguna"}`
                  : `${ciudades.filter((c) => c.estado === "completada").length} de ${ciudades.length} descargadas`}
              </p>
            </div>
            <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
              {ciudades.map((c) => (
                <li
                  key={c.ciudad.id}
                  className="rounded-2xl bg-secondary/50 p-3 text-xs"
                  title={[c.estadoHttp && `HTTP ${c.estadoHttp}`, c.duracionMs !== undefined && formatoDuracion(c.duracionMs), c.intentos > 1 && `${c.intentos} intentos`].filter(Boolean).join(" · ") || undefined}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 font-medium">
                      {c.ciudad.nombre}
                      {c.desdeCache && <span className="rounded bg-muted px-1 text-[0.65rem] font-normal text-muted-foreground">desde caché</span>}
                    </span>
                    <IndicadorEstado
                      estado={c.estado}
                      texto={
                        c.estado === "en_curso"
                          ? "Descargando…"
                          : c.estado === "completada"
                            ? "Descargada"
                            : c.estado === "error"
                              ? "Error"
                              : "En espera"
                      }
                    />
                  </div>
                  {c.error && (
                    <div className="mt-1.5 grid gap-1.5">
                      <p className="text-destructive">{c.error}</p>
                      <Button variant="outline" size="xs" disabled={extrayendo} onClick={() => alReintentar(c.ciudad.id)}>
                        <RotateCw />
                        Reintentar {c.ciudad.nombre}
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
      </CardContent>
    </Card>
  )
}
