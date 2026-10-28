"use client"

import * as React from "react"
import dynamic from "next/dynamic"
import { Trophy } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { resumirPorCiudad, type ResumenCiudad } from "@/lib/analisis"
import { CIUDADES } from "@/lib/etl/ciudades"
import { formatoEntero, formatoNumero } from "@/lib/etl/formato"
import type { Medicion } from "@/lib/etl/tipos"
import { cn } from "@/lib/utils"
import { CabeceraTarjeta } from "./cabecera-tarjeta"
import { CarruselCiudades } from "./carrusel-ciudades"
import { EstadoVacio } from "./estado-vacio"
import { ValorAnimado } from "./valor-animado"

// Leaflet necesita window: el mapa solo se renderiza en el navegador.
const MapaEspana = dynamic(() => import("./mapa-espana").then((m) => m.MapaEspana), {
  ssr: false,
  loading: () => <div className="size-full bg-muted" />,
})

// Clave pública de MapTiler (se incrusta en el build desde .env.local).
const CLAVE_MAPTILER = process.env.NEXT_PUBLIC_MAPTILER_KEY

type Metrica = "temperatura" | "humedad" | "precipitacion" | "registros"

const METRICAS: Record<Metrica, { etiqueta: string; unidad: string; valor: (r: ResumenCiudad) => number; formato: (n: number) => string }> = {
  temperatura: { etiqueta: "Temperatura media", unidad: "°C", valor: (r) => r.temperaturaMedia, formato: formatoNumero },
  humedad: { etiqueta: "Humedad media", unidad: "%", valor: (r) => r.humedadMedia, formato: formatoNumero },
  precipitacion: { etiqueta: "Precipitación total", unidad: "mm", valor: (r) => r.precipitacionTotal, formato: formatoNumero },
  registros: { etiqueta: "Registros válidos", unidad: "", valor: (r) => r.registros, formato: formatoEntero },
}

export function SeccionMapa({
  activa,
  alSeleccionar,
  validos,
}: {
  activa: string
  alSeleccionar: (id: string) => void
  validos: Medicion[]
}) {
  const [metrica, setMetrica] = React.useState<Metrica>("temperatura")
  const m = METRICAS[metrica]
  const resumenes = React.useMemo(() => resumirPorCiudad(validos), [validos])

  // Ciudades con datos, de mayor a menor según la métrica
  const ranking = CIUDADES.filter((c) => resumenes[c.nombre])
    .map((c) => ({ ciudad: c, valor: m.valor(resumenes[c.nombre]) }))
    .sort((a, b) => b.valor - a.valor)
  const max = ranking[0]?.valor ?? 0
  const min = ranking.at(-1)?.valor ?? 0
  const intensidades = Object.fromEntries(
    CIUDADES.map((c) => {
      const r = resumenes[c.nombre]
      if (!r) return [c.id, null]
      return [c.id, max === min ? 0.6 : (m.valor(r) - min) / (max - min)]
    })
  )
  const conUnidad = (n: number) => (m.unidad ? `${m.formato(n)} ${m.unidad}` : m.formato(n))

  return (
    <section id="mapa" data-aparecer aria-label="Mapa de ciudades" className="grid gap-6 lg:grid-cols-4">
      <CarruselCiudades resumenes={resumenes} activa={activa} alSeleccionar={alSeleccionar} />
      <Card className="min-w-0 lg:col-span-3">
        <CabeceraTarjeta titulo="Mapa de ciudades" subtitulo="Pulsa una ciudad para verla en detalle." />
        <CardContent className="grid gap-3">
          {/* Selector segmentado de la métrica */}
          <div role="group" aria-label="Métrica del mapa" className="flex w-fit max-w-full flex-wrap gap-1">
            {(Object.keys(METRICAS) as Metrica[]).map((k) => (
              <button
                key={k}
                type="button"
                aria-pressed={metrica === k}
                onClick={() => setMetrica(k)}
                className="rounded-full px-3 py-1.5 text-xs font-medium transition-colors duration-150 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 aria-pressed:bg-primary aria-pressed:text-primary-foreground not-aria-pressed:text-muted-foreground not-aria-pressed:hover:text-foreground"
              >
                {METRICAS[k].etiqueta}
                {METRICAS[k].unidad && ` (${METRICAS[k].unidad})`}
              </button>
            ))}
          </div>

          {/* isolate: las capas de Leaflet (z-index altos) no tapan menús del resto de la página. */}
          <div className="isolate h-[480px] overflow-hidden rounded-2xl">
            {CLAVE_MAPTILER ? (
              <MapaEspana claveMapTiler={CLAVE_MAPTILER} activa={activa} resumenes={resumenes} intensidades={intensidades} alSeleccionar={alSeleccionar} />
            ) : (
              <p className="flex size-full items-center justify-center bg-muted p-4 text-center text-sm text-muted-foreground">
                Falta configurar NEXT_PUBLIC_MAPTILER_KEY
              </p>
            )}
          </div>

          {/* Leyenda de la escala */}
          <div className="flex items-center gap-2 text-[0.7rem] text-muted-foreground">
            {ranking.length ? (
              <>
                <span className="tabular-nums">{conUnidad(min)}</span>
                <span
                  aria-hidden
                  className="h-2 w-32 rounded-full"
                  style={{ background: "linear-gradient(to right, color-mix(in oklch, var(--primary) 15%, var(--card)), var(--primary))" }}
                />
                <span className="tabular-nums">{conUnidad(max)}</span>
              </>
            ) : (
              <span>Extrae datos para colorear el mapa.</span>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="min-w-0">
        <CabeceraTarjeta titulo="Ranking" subtitulo={m.etiqueta} />
        <CardContent>
          {ranking.length ? (
            <ol className="grid gap-1.5">
              {ranking.map(({ ciudad, valor }, i) => (
                <li key={ciudad.id}>
                  <button
                    type="button"
                    aria-pressed={ciudad.id === activa}
                    onClick={() => alSeleccionar(ciudad.id)}
                    className={cn(
                      "grid w-full gap-1.5 rounded-2xl px-3 py-2.5 text-left transition-[transform,box-shadow,background-color] duration-200 outline-none hover:-translate-y-0.5 hover:bg-secondary/50 hover:shadow-tarjeta focus-visible:ring-3 focus-visible:ring-ring/50",
                      "aria-pressed:bg-secondary"
                    )}
                  >
                    <span className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="font-medium">
                        <span className="mr-1.5 text-xs text-muted-foreground tabular-nums">{i + 1}.</span>
                        {ciudad.nombre}
                      </span>
                      <span className="font-semibold tabular-nums">
                        <ValorAnimado valor={valor} datos={resumenes} formato={conUnidad} />
                      </span>
                    </span>
                    <span aria-hidden className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <span className="block h-full rounded-full bg-primary" style={{ width: `${max > 0 ? Math.max(0, (valor / max) * 100) : 0}%` }} />
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          ) : (
            <EstadoVacio icono={Trophy}>Extrae datos para ver el ranking</EstadoVacio>
          )}
        </CardContent>
      </Card>
    </section>
  )
}
