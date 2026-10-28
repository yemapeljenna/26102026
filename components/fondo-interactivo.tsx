"use client"

import * as React from "react"

import { useMovimientoReducido } from "@/hooks/use-movimiento-reducido"

const SUAVIZADO = 0.08 // fracción del camino que recorre en cada fotograma (lerp)

/** Halo grande del color primario que sigue al cursor con retardo. En táctil o con movimiento reducido, quieto. */
export function FondoInteractivo() {
  const capa = React.useRef<HTMLDivElement>(null)
  const reducido = useMovimientoReducido()

  React.useEffect(() => {
    const el = capa.current
    if (!el || reducido || !window.matchMedia("(pointer: fine)").matches) return
    const actual = { x: window.innerWidth / 2, y: window.innerHeight * 0.2 }
    const destino = { ...actual }
    let marco = 0

    const pintar = () => {
      actual.x += (destino.x - actual.x) * SUAVIZADO
      actual.y += (destino.y - actual.y) * SUAVIZADO
      el.style.setProperty("--x", `${actual.x}px`)
      el.style.setProperty("--y", `${actual.y}px`)
      // Se detiene al llegar: no hay bucle mientras el ratón está quieto
      marco = Math.abs(destino.x - actual.x) + Math.abs(destino.y - actual.y) > 0.5 ? requestAnimationFrame(pintar) : 0
    }
    const alMover = (e: PointerEvent) => {
      destino.x = e.clientX
      destino.y = e.clientY
      if (!marco) marco = requestAnimationFrame(pintar)
    }
    window.addEventListener("pointermove", alMover, { passive: true })
    return () => {
      window.removeEventListener("pointermove", alMover)
      cancelAnimationFrame(marco)
    }
  }, [reducido])

  return (
    <div
      ref={capa}
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-[1]"
      style={{
        // Centro de luz pequeño e intenso sobre un halo grande; las opacidades dependen del tema (globals.css)
        background: [
          "radial-gradient(250px circle at var(--x, 50%) var(--y, 20%), color-mix(in oklch, var(--primary) var(--halo-interior), transparent), transparent 70%)",
          "radial-gradient(700px circle at var(--x, 50%) var(--y, 20%), color-mix(in oklch, var(--primary) var(--halo-exterior), transparent), transparent 70%)",
        ].join(", "),
      }}
    />
  )
}
