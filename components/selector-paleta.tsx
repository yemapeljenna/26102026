"use client"

import * as React from "react"
import { Palette, RotateCcw } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverDescription, PopoverHeader, PopoverTitle, PopoverTrigger } from "@/components/ui/popover"
import {
  CLAVE_PALETA,
  CROMA_MAX,
  CROMA_MIN,
  CROMA_ROSA,
  generarPaleta,
  TONO_ROSA,
  TONOS_RAPIDOS,
  VARIABLES_PALETA,
} from "@/lib/paleta"
import { cn } from "@/lib/utils"

type Eleccion = { tono: number; croma: number }

const ROSA: Eleccion = { tono: TONO_ROSA, croma: CROMA_ROSA }
const esRosa = (e: Eleccion) => e.tono === ROSA.tono && e.croma === ROSA.croma

function eleccionGuardada(): Eleccion {
  if (typeof window === "undefined") return ROSA
  try {
    const p = JSON.parse(localStorage.getItem(CLAVE_PALETA) ?? "null") as Partial<Eleccion> | null
    return { tono: p?.tono ?? ROSA.tono, croma: p?.croma ?? ROSA.croma }
  } catch {
    return ROSA
  }
}

/** Aplica la elección en <html> y la guarda. El rosa original quita las variables y vuelve a los tokens de globals.css. */
function aplicar(e: Eleccion) {
  const estilo = document.documentElement.style
  try {
    if (esRosa(e)) {
      VARIABLES_PALETA.forEach((v) => estilo.removeProperty(v))
      localStorage.removeItem(CLAVE_PALETA)
      return
    }
    const variables = generarPaleta(e.tono, e.croma)
    Object.entries(variables).forEach(([k, v]) => estilo.setProperty(k, v))
    localStorage.setItem(CLAVE_PALETA, JSON.stringify({ ...e, variables }))
  } catch {
    // Sin localStorage: la paleta se aplica igual, solo no se recuerda
  }
}

const claseBarra =
  "h-2.5 w-full cursor-pointer appearance-none rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50 [&::-moz-range-thumb]:size-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:bg-primary [&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow"

// Barra con todo el círculo de tonos
const DEGRADADO_TONOS = `linear-gradient(to right, ${Array.from({ length: 13 }, (_, i) => `oklch(0.65 0.17 ${i * 30})`).join(", ")})`

function Barra({ etiqueta, valor, ...props }: { etiqueta: string; valor: string } & React.ComponentProps<"input">) {
  return (
    <label className="grid gap-2 text-xs font-medium">
      <span className="flex justify-between">
        {etiqueta} <span className="font-mono text-muted-foreground">{valor}</span>
      </span>
      <input type="range" className={claseBarra} {...props} />
    </label>
  )
}

export function SelectorPaleta({ className }: { className?: string }) {
  // Los valores solo se pintan dentro del popover (que no se renderiza en el servidor): no hay desajuste al hidratar
  const [eleccion, setEleccion] = React.useState(eleccionGuardada)
  const { tono, croma } = eleccion

  function cambiar(cambio: Partial<Eleccion>) {
    const nueva = { ...eleccion, ...cambio }
    setEleccion(nueva)
    aplicar(nueva)
  }

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button variant="ghost" size="icon-lg" aria-label="Elegir paleta de color" title="Paleta de color" className={cn("rounded-full", className)} />
        }
      >
        <Palette className="size-5" />
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={12} className="w-72 gap-4 p-4">
        <PopoverHeader>
          <PopoverTitle>Paleta de color</PopoverTitle>
          <PopoverDescription className="text-xs">Elige el tono y la intensidad de la interfaz.</PopoverDescription>
        </PopoverHeader>

        <div className="grid grid-cols-7 gap-2" role="group" aria-label="Colores rápidos">
          {TONOS_RAPIDOS.map((t) => (
            <button
              key={t.nombre}
              type="button"
              title={t.nombre}
              aria-label={t.nombre}
              aria-pressed={tono === t.tono && croma === t.croma}
              onClick={() => cambiar({ tono: t.tono, croma: t.croma })}
              style={{ background: `oklch(0.53 ${t.croma} ${t.tono})` }}
              className="aspect-square w-full rounded-full ring-offset-2 ring-offset-popover transition-transform duration-150 outline-none hover:scale-110 focus-visible:ring-2 focus-visible:ring-ring aria-pressed:ring-2 aria-pressed:ring-foreground"
            />
          ))}
        </div>

        <Barra
          etiqueta="Tono"
          valor={`${tono}°`}
          min={0}
          max={360}
          value={tono}
          onChange={(e) => cambiar({ tono: Number(e.target.value) })}
          style={{ background: DEGRADADO_TONOS }}
        />
        <Barra
          etiqueta="Intensidad"
          valor={croma.toFixed(2)}
          min={CROMA_MIN}
          max={CROMA_MAX}
          step={0.01}
          value={croma}
          onChange={(e) => cambiar({ croma: Number(e.target.value) })}
          style={{ background: `linear-gradient(to right, oklch(0.65 ${CROMA_MIN} ${tono}), oklch(0.65 ${CROMA_MAX} ${tono}))` }}
        />


        <Button variant="outline" size="sm" onClick={() => cambiar(ROSA)} disabled={esRosa(eleccion)}>
          <RotateCcw data-icon="inline-start" />
          Restablecer
        </Button>
      </PopoverContent>
    </Popover>
  )
}
