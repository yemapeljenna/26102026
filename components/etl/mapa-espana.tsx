"use client"

import "leaflet/dist/leaflet.css"

import * as React from "react"
import { latLngBounds } from "leaflet"
import { Circle, MapContainer, Popup, TileLayer, Tooltip, useMap } from "react-leaflet"

import { CIUDADES } from "@/lib/etl/ciudades"
import { formatoNumero } from "@/lib/etl/formato"
import type { ResumenCiudad } from "./tipos-sesion"

// Encuadre que contiene las cinco ciudades.
const LIMITES = latLngBounds(CIUDADES.map((c) => [c.latitud, c.longitud]))
const OPCIONES_ENCUADRE = { padding: [32, 32] as [number, number] }
const RADIO_ZONA_M = 18_000

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

export function MapaEspana({
  claveMapTiler,
  ciudadesSel,
  activa,
  resumenes,
  alSeleccionar,
}: {
  claveMapTiler: string
  ciudadesSel: string[]
  activa: string
  /** Resumen del periodo por nombre de ciudad; vacío hasta que hay datos válidos. */
  resumenes: Record<string, ResumenCiudad>
  alSeleccionar: (id: string) => void
}) {
  return (
    // Sin control de atribución: así no aparece el prefijo «Leaflet» con la bandera.
    <MapContainer bounds={LIMITES} boundsOptions={OPCIONES_ENCUADRE} zoomSnap={0.5} attributionControl={false} className="size-full">
      {/* Teselas de 512 px: Leaflet necesita tileSize 512 y zoomOffset -1 (documentación de MapTiler). */}
      <TileLayer
        url={`https://api.maptiler.com/maps/dataviz-dark/{z}/{x}/{y}.png?key=${claveMapTiler}`}
        tileSize={512}
        zoomOffset={-1}
        minZoom={1}
        crossOrigin
      />
      <AjustarTamano />
      {CIUDADES.map((c) => {
        const enConfig = ciudadesSel.includes(c.id)
        const esActiva = c.id === activa
        const resumen = resumenes[c.nombre]
        return (
          <Circle
            key={c.id}
            center={[c.latitud, c.longitud]}
            radius={RADIO_ZONA_M}
            // El color sale de la clase (variable --primary del tema); aquí solo opacidad y grosor.
            pathOptions={{
              className: "zona-ciudad",
              weight: esActiva ? 3 : 1.5,
              opacity: enConfig ? 1 : 0.35,
              fillOpacity: !enConfig ? 0.1 : esActiva ? 0.55 : 0.3,
            }}
            eventHandlers={{ click: () => alSeleccionar(c.id) }}
          >
            <Tooltip permanent direction="top" offset={[0, -6]} className="etiqueta-ciudad">
              <span className={enConfig ? undefined : "opacity-50"}>{c.nombre}</span>
            </Tooltip>
            <Popup>
              <p className="font-medium">{c.nombre}</p>
              {resumen ? (
                <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-3 tabular-nums">
                  <dt className="text-muted-foreground">Temp. media</dt>
                  <dd>{formatoNumero(resumen.temperaturaMedia)} °C</dd>
                  <dt className="text-muted-foreground">Humedad media</dt>
                  <dd>{formatoNumero(resumen.humedadMedia)} %</dd>
                  <dt className="text-muted-foreground">Precipitación</dt>
                  <dd>{formatoNumero(resumen.precipitacionTotal)} mm</dd>
                </dl>
              ) : (
                <p className="mt-1.5 text-muted-foreground">Extrae datos para ver el resumen</p>
              )}
            </Popup>
          </Circle>
        )
      })}
    </MapContainer>
  )
}
