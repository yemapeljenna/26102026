"use client"

import * as React from "react"
import { CloudRain, Droplets } from "lucide-react"

import type { ResumenCiudad } from "@/lib/analisis"
import { CIUDADES } from "@/lib/etl/ciudades"
import { formatoNumero } from "@/lib/etl/formato"
import { cn } from "@/lib/utils"

const INCLINACION_MAX = 6 // grados
const UMBRAL_ARRASTRE = 5 // px antes de considerar que es un arrastre y no un clic

const redondear = (n: number) => formatoNumero(Math.round(n * 10) / 10)

/** Inclina la tarjeta hacia el puntero y coloca el brillo donde está (variables CSS). */
function alMoverSobreTarjeta(e: React.PointerEvent<HTMLButtonElement>) {
  if (e.pointerType !== "mouse") return
  const r = e.currentTarget.getBoundingClientRect()
  const x = (e.clientX - r.left) / r.width
  const y = (e.clientY - r.top) / r.height
  const estilo = e.currentTarget.style
  estilo.setProperty("--rx", `${(0.5 - y) * INCLINACION_MAX * 2}deg`)
  estilo.setProperty("--ry", `${(x - 0.5) * INCLINACION_MAX * 2}deg`)
  estilo.setProperty("--x", `${x * 100}%`)
  estilo.setProperty("--y", `${y * 100}%`)
}

function alSalirDeTarjeta(e: React.PointerEvent<HTMLButtonElement>) {
  e.currentTarget.style.setProperty("--rx", "0deg")
  e.currentTarget.style.setProperty("--ry", "0deg")
}

/** Tarjetas de ciudad deslizables (swipe en táctil, arrastre con ratón). Pulsar una la selecciona. */
export function CarruselCiudades({
  resumenes,
  activa,
  alSeleccionar,
}: {
  resumenes: Record<string, ResumenCiudad>
  activa: string
  alSeleccionar: (id: string) => void
}) {
  const pista = React.useRef<HTMLUListElement>(null)
  const arrastre = React.useRef<{ x: number; scroll: number; movido: boolean } | null>(null)
  const ciudades = CIUDADES.filter((c) => resumenes[c.nombre])
  if (!ciudades.length) return null

  // Arrastre con ratón: el táctil ya desliza de forma nativa
  function alPulsar(e: React.PointerEvent<HTMLUListElement>) {
    if (e.pointerType !== "mouse" || e.button !== 0) return
    arrastre.current = { x: e.clientX, scroll: e.currentTarget.scrollLeft, movido: false }
  }
  function alMover(e: React.PointerEvent<HTMLUListElement>) {
    const a = arrastre.current
    if (!a) return
    const dx = e.clientX - a.x
    if (!a.movido && Math.abs(dx) < UMBRAL_ARRASTRE) return
    a.movido = true
    // Sin snap mientras se arrastra, para que siga al ratón
    e.currentTarget.classList.add("snap-none")
    e.currentTarget.scrollLeft = a.scroll - dx
  }
  function alSoltar() {
    pista.current?.classList.remove("snap-none")
    // El clic llega después del pointerup: se descarta si hubo arrastre
    setTimeout(() => (arrastre.current = null))
  }

  return (
    <ul
      ref={pista}
      aria-label="Ciudades"
      onPointerDown={alPulsar}
      onPointerMove={alMover}
      onPointerUp={alSoltar}
      onPointerLeave={alSoltar}
      onClickCapture={(e) => {
        if (arrastre.current?.movido) {
          e.preventDefault()
          e.stopPropagation()
        }
      }}
      className="-mx-1 flex snap-x snap-mandatory gap-4 overflow-x-auto px-1 py-3 [scrollbar-width:thin] lg:col-span-4"
    >
      {ciudades.map((c) => {
        const r = resumenes[c.nombre]
        return (
          <li key={c.id} className="shrink-0 snap-start">
            <button
              type="button"
              aria-pressed={c.id === activa}
              onClick={() => alSeleccionar(c.id)}
              onPointerMove={alMoverSobreTarjeta}
              onPointerLeave={alSalirDeTarjeta}
              className={cn(
                "group relative grid w-44 gap-2 overflow-hidden rounded-3xl bg-card p-5 text-left shadow-tarjeta transition-[transform,translate,box-shadow] duration-200 ease-out outline-none select-none hover:-translate-y-0.5 hover:shadow-tarjeta-hover focus-visible:ring-3 focus-visible:ring-ring/50",
                "motion-safe:[transform:perspective(700px)_rotateX(var(--rx,0deg))_rotateY(var(--ry,0deg))]",
                "aria-pressed:ring-2 aria-pressed:ring-primary"
              )}
            >
              {/* Brillo que sigue al puntero */}
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100 bg-[radial-gradient(circle_at_var(--x,50%)_var(--y,50%),rgb(255_255_255/0.45),transparent_60%)] dark:bg-[radial-gradient(circle_at_var(--x,50%)_var(--y,50%),rgb(255_255_255/0.08),transparent_60%)]"
              />
              <span className="relative text-sm font-medium text-muted-foreground group-aria-pressed:text-primary">{c.nombre}</span>
              <span className="relative text-4xl font-bold tracking-tight tabular-nums">{redondear(r.temperaturaMedia)}°</span>
              <span className="relative grid gap-1 text-xs text-muted-foreground tabular-nums">
                <span className="flex items-center gap-1.5">
                  <Droplets aria-hidden className="size-3.5 text-primary" />
                  {redondear(r.humedadMedia)} % de humedad
                </span>
                <span className="flex items-center gap-1.5">
                  <CloudRain aria-hidden className="size-3.5 text-primary" />
                  {redondear(r.precipitacionTotal)} mm de lluvia
                </span>
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
