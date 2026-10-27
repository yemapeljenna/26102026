"use client"

import { ArrowDown, ArrowRight, RotateCw } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { formatoDuracion, formatoEntero } from "@/lib/etl/formato"
import { cn } from "@/lib/utils"
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
  inspeccionar?: { pestana: PestanaInspeccion; texto: string } | { ancla: string; texto: string }
}

function Contador({ valor, etiqueta }: { valor: number | null; etiqueta: string }) {
  return (
    <div>
      <dt className="text-[0.7rem] text-muted-foreground">{etiqueta}</dt>
      <dd className="text-lg font-semibold tabular-nums">{valor === null ? "—" : formatoEntero(valor)}</dd>
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
  alInspeccionar: (destino: PestanaInspeccion | { ancla: string }) => void
  alReintentar: (id: string) => void
}) {
  const procesadas = ciudades.filter((c) => c.estado === "completada" || c.estado === "error")
  const pendientes = ciudades.filter((c) => c.estado === "pendiente" || c.estado === "en_curso")

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>2. Pipeline ETL</h2>
        </CardTitle>
        <CardDescription>
          Cada fase muestra su estado, los registros que recibe y entrega, y su duración real medida en el navegador.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5">
        <ol className="grid gap-2 xl:grid-cols-[repeat(5,minmax(0,1fr))] xl:gap-0" aria-label="Fases del pipeline">
          {fases.map((f, i) => (
            <li key={f.id} className="flex flex-col items-stretch xl:flex-row xl:items-stretch">
              <article
                aria-label={`Fase ${i + 1}: ${f.titulo}`}
                className={cn(
                  "flex flex-1 flex-col gap-2 rounded-lg border bg-card p-3",
                  f.estado === "en_curso" && "border-sky-500/60",
                  f.estado === "error" && "border-destructive/60",
                  f.estado === "completada" && "border-emerald-600/40"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-semibold">
                    <span className="text-muted-foreground">{i + 1}.</span> {f.titulo}
                  </h3>
                </div>
                <IndicadorEstado estado={f.estado} />
                <p className="text-xs text-muted-foreground">{f.explicacion}</p>
                <dl className="mt-auto grid grid-cols-2 gap-2 border-t pt-2">
                  <Contador {...f.entrada} />
                  <Contador {...f.salida} />
                </dl>
                {f.nota && <p className="text-xs">{f.nota}</p>}
                <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>
                    Duración: <span className="tabular-nums text-foreground">{formatoDuracion(f.duracionMs)}</span>
                  </span>
                  {f.inspeccionar && (
                    <Button
                      variant="link"
                      size="xs"
                      className="px-0"
                      onClick={() =>
                        alInspeccionar("pestana" in f.inspeccionar! ? f.inspeccionar!.pestana : { ancla: f.inspeccionar!.ancla })
                      }
                    >
                      {f.inspeccionar.texto}
                    </Button>
                  )}
                </div>
              </article>
              {i < fases.length - 1 && (
                <div aria-hidden className="flex items-center justify-center py-0.5 text-muted-foreground xl:px-1 xl:py-0">
                  <ArrowDown className="size-4 xl:hidden" />
                  <ArrowRight className="hidden size-4 xl:block" />
                </div>
              )}
            </li>
          ))}
        </ol>

        {ciudades.length > 0 && (
          <section aria-labelledby="titulo-peticiones">
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
              <h3 id="titulo-peticiones" className="text-sm font-semibold">
                Peticiones por ciudad
              </h3>
              <p className="text-xs text-muted-foreground" aria-live="polite">
                {extrayendo
                  ? `Procesadas ${procesadas.length} de ${ciudades.length} · pendientes: ${pendientes.map((c) => c.ciudad.nombre).join(", ") || "ninguna"}`
                  : `${ciudades.filter((c) => c.estado === "completada").length} de ${ciudades.length} completadas`}
              </p>
            </div>
            <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
              {ciudades.map((c) => (
                <li key={c.ciudad.id} className="rounded-lg border p-2.5 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{c.ciudad.nombre}</span>
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
                  <p className="mt-1 text-muted-foreground">
                    {c.estadoHttp ? `HTTP ${c.estadoHttp} · ` : ""}
                    {formatoDuracion(c.duracionMs)}
                    {c.intentos > 1 ? ` · ${c.intentos} intentos` : ""}
                  </p>
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
