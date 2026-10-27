"use client"

import * as React from "react"
import dynamic from "next/dynamic"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { buscarCiudad } from "@/lib/etl/ciudades"
import { formatoEntero, formatoNumero } from "@/lib/etl/formato"
import type { Medicion } from "@/lib/etl/tipos"
import type { ResumenCiudad } from "./tipos-sesion"

// Leaflet necesita window: el mapa solo se renderiza en el navegador.
const MapaEspana = dynamic(() => import("./mapa-espana").then((m) => m.MapaEspana), {
  ssr: false,
  loading: () => <div className="size-full bg-muted" />,
})

// Clave pública de MapTiler (se incrusta en el build desde .env.local).
const CLAVE_MAPTILER = process.env.NEXT_PUBLIC_MAPTILER_KEY

/** Medias y total del periodo por nombre de ciudad, a partir de los registros válidos. */
function resumirPorCiudad(validos: Medicion[]): Record<string, ResumenCiudad> {
  const resumenes: Record<string, ResumenCiudad> = {}
  for (const m of validos) {
    const r = (resumenes[m.ciudad] ??= { registros: 0, temperaturaMedia: 0, humedadMedia: 0, precipitacionTotal: 0 })
    r.registros++
    r.temperaturaMedia += m.temperatura_c
    r.humedadMedia += m.humedad_pct
    r.precipitacionTotal += m.precipitacion_mm
  }
  for (const r of Object.values(resumenes)) {
    r.temperaturaMedia /= r.registros
    r.humedadMedia /= r.registros
  }
  return resumenes
}

export function PanelMapa({
  ciudadesSel,
  activa,
  alSeleccionar,
  validos,
}: {
  ciudadesSel: string[]
  activa: string
  alSeleccionar: (id: string) => void
  validos: Medicion[]
}) {
  const resumenes = React.useMemo(() => resumirPorCiudad(validos), [validos])
  const ciudad = buscarCiudad(activa)!
  const resumen = resumenes[ciudad.nombre]
  const enConfig = ciudadesSel.includes(ciudad.id)
  const datos = resumen
    ? [
        { etiqueta: "Temp. media", valor: `${formatoNumero(resumen.temperaturaMedia)} °C` },
        { etiqueta: "Humedad media", valor: `${formatoNumero(resumen.humedadMedia)} %` },
        { etiqueta: "Precipitación", valor: `${formatoNumero(resumen.precipitacionTotal)} mm` },
      ]
    : []

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Mapa de ciudades</h2>
        </CardTitle>
        <CardDescription>Pulsa una zona para seleccionar la ciudad. Las apagadas no están en la configuración.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {/* isolate: las capas de Leaflet (z-index altos) no tapan menús del resto de la página. */}
        <div className="isolate h-[340px] overflow-hidden rounded-lg border">
          {CLAVE_MAPTILER ? (
            <MapaEspana
              claveMapTiler={CLAVE_MAPTILER}
              ciudadesSel={ciudadesSel}
              activa={activa}
              resumenes={resumenes}
              alSeleccionar={alSeleccionar}
            />
          ) : (
            <p className="flex size-full items-center justify-center bg-muted p-4 text-center text-sm text-muted-foreground">
              Falta configurar NEXT_PUBLIC_MAPTILER_KEY
            </p>
          )}
        </div>

        <section aria-label="Resumen de la ciudad seleccionada" className="grid gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-medium">{ciudad.nombre}</p>
            <Badge variant={enConfig ? "default" : "outline"}>{enConfig ? "En la extracción" : "No seleccionada"}</Badge>
          </div>
          {resumen ? (
            <>
              <dl className="grid gap-2">
                {datos.map((d) => (
                  <div key={d.etiqueta} className="flex items-baseline justify-between gap-2 rounded-lg bg-muted/60 px-3 py-2">
                    <dt className="text-xs text-muted-foreground">{d.etiqueta}</dt>
                    <dd className="font-semibold tabular-nums">{d.valor}</dd>
                  </div>
                ))}
              </dl>
              <p className="text-[0.7rem] text-muted-foreground">
                Calculado con {formatoEntero(resumen.registros)} registros válidos del periodo extraído.
              </p>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">Extrae datos para ver la temperatura, la humedad y la precipitación del periodo.</p>
          )}
        </section>
      </CardContent>
    </Card>
  )
}
