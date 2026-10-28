"use client"

import "leaflet/dist/leaflet.css"

import * as React from "react"
import { latLngBounds, type Circle as CirculoLeaflet, type Tooltip as TooltipLeaflet } from "leaflet"
import { useTheme } from "next-themes"
import { Circle, MapContainer, TileLayer, Tooltip, useMap } from "react-leaflet"

import type { ResumenCiudad } from "@/lib/analisis"
import { CIUDADES, type Ciudad } from "@/lib/etl/ciudades"
import { formatoNumero } from "@/lib/etl/formato"

// Encuadre que contiene las cinco ciudades.
const LIMITES = latLngBounds(CIUDADES.map((c) => [c.latitud, c.longitud]))
const OPCIONES_ENCUADRE = { padding: [40, 40] as [number, number] }
const RADIO_ZONA_M = 22_000

/** Recalcula el tamaño del mapa al montarlo y cuando cambia su contenedor (evita la zona gris). */
function AjustarTamano() {
  const mapa = useMap()
  React.useEffect(() => {
    mapa.invalidateSize()
    mapa.fitBounds(LIMITES, OPCIONES_ENCUADRE)
    const observador = new ResizeObserver(() => mapa.invalidateSize())
    observador.observe(mapa.getContainer())
    return () => observador.disconnect()
  }, [mapa])
  return null
}

/** Zona de una ciudad. El color va en el estilo del SVG porque Leaflet no admite var() en sus atributos. */
function ZonaCiudad({
  ciudad,
  activa,
  intensidad,
  resumen,
  alSeleccionar,
}: {
  ciudad: Ciudad
  activa: boolean
  /** 0-1 según el valor de la métrica; null = sin datos (gris neutro). */
  intensidad: number | null
  resumen?: ResumenCiudad
  alSeleccionar: (id: string) => void
}) {
  const zona = React.useRef<CirculoLeaflet>(null)
  const etiqueta = React.useRef<TooltipLeaflet>(null)
  const [encima, setEncima] = React.useState(false)

  React.useEffect(() => {
    const el = zona.current?.getElement() as SVGElement | undefined
    if (!el) return
    // Escala del primario: más intenso = valor más alto
    el.style.fill = intensidad === null ? "oklch(0.7 0 0)" : `color-mix(in oklch, var(--primary) ${Math.round(15 + intensidad * 80)}%, var(--card))`
    el.style.stroke = intensidad === null ? "oklch(0.55 0 0)" : ""
  }, [intensidad])

  // La etiqueta crece al mostrar los datos: hay que recolocarla
  React.useEffect(() => {
    etiqueta.current?.update()
  }, [encima])

  return (
    <Circle
      ref={zona}
      center={[ciudad.latitud, ciudad.longitud]}
      radius={RADIO_ZONA_M}
      pathOptions={{
        className: "zona-ciudad",
        weight: activa ? 3.5 : 1.5,
        fillOpacity: intensidad === null ? 0.35 : activa ? 0.95 : 0.8,
      }}
      eventHandlers={{
        click: () => alSeleccionar(ciudad.id),
        mouseover: () => setEncima(true),
        mouseout: () => setEncima(false),
      }}
    >
      <Tooltip ref={etiqueta} permanent direction="top" offset={[0, -8]} className="etiqueta-ciudad">
        <span>{ciudad.nombre}</span>
        {encima &&
          (resumen ? (
            <dl className="mt-1 grid grid-cols-[auto_auto] gap-x-3 font-normal text-foreground tabular-nums">
              <dt className="text-muted-foreground">Temp. media</dt>
              <dd className="text-right">{formatoNumero(resumen.temperaturaMedia)} °C</dd>
              <dt className="text-muted-foreground">Humedad media</dt>
              <dd className="text-right">{formatoNumero(resumen.humedadMedia)} %</dd>
              <dt className="text-muted-foreground">Precipitación</dt>
              <dd className="text-right">{formatoNumero(resumen.precipitacionTotal)} mm</dd>
            </dl>
          ) : (
            <p className="mt-1 font-normal text-muted-foreground">Sin datos</p>
          ))}
      </Tooltip>
    </Circle>
  )
}

export function MapaEspana({
  claveMapTiler,
  activa,
  resumenes,
  intensidades,
  alSeleccionar,
}: {
  claveMapTiler: string
  activa: string
  /** Resumen del periodo por nombre de ciudad; vacío hasta que hay datos válidos. */
  resumenes: Record<string, ResumenCiudad>
  /** Intensidad 0-1 por id de ciudad, o null si no tiene datos. */
  intensidades: Record<string, number | null>
  alSeleccionar: (id: string) => void
}) {
  const estilo = useTheme().resolvedTheme === "dark" ? "dataviz-dark" : "dataviz"
  return (
    // Sin control de atribución: así no aparece el prefijo «Leaflet» con la bandera.
    <MapContainer bounds={LIMITES} boundsOptions={OPCIONES_ENCUADRE} zoomSnap={0.5} attributionControl={false} className="size-full">
      {/* Teselas de 512 px: Leaflet necesita tileSize 512 y zoomOffset -1 (documentación de MapTiler). */}
      <TileLayer
        url={`https://api.maptiler.com/maps/${estilo}/{z}/{x}/{y}.png?key=${claveMapTiler}`}
        tileSize={512}
        zoomOffset={-1}
        minZoom={1}
        crossOrigin
      />
      <AjustarTamano />
      {CIUDADES.map((c) => (
        <ZonaCiudad
          key={c.id}
          ciudad={c}
          activa={c.id === activa}
          intensidad={intensidades[c.id] ?? null}
          resumen={resumenes[c.nombre]}
          alSeleccionar={alSeleccionar}
        />
      ))}
    </MapContainer>
  )
}
