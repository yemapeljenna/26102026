"use client"

import * as React from "react"

import { useMovimientoReducido } from "@/hooks/use-movimiento-reducido"

export type TipoClima = "lluvia" | "luz" | "nubes"

const PARTICULAS: Record<TipoClima, number> = { lluvia: 40, luz: 30, nubes: 8 }
const OPACIDAD: Record<TipoClima, number> = { lluvia: 0.22, luz: 0.35, nubes: 0.1 }
const FUNDIDO = 0.03 // cambio de opacidad por fotograma al cambiar de ciudad

interface Particula {
  x: number
  y: number
  vx: number
  vy: number
  r: number
  fase: number
}

/** Tipo de partículas según los datos de la ciudad seleccionada (null si no hay datos). */
export function tipoClima(datos: { lluvia: number; temperatura: number } | null): TipoClima | null {
  if (!datos) return null
  if (datos.lluvia > 0) return "lluvia"
  return datos.temperatura > 20 ? "luz" : "nubes"
}

function crear(tipo: TipoClima, an: number, al: number, alAzar = true): Particula {
  const y = alAzar ? Math.random() * al : tipo === "luz" ? al + 10 : -20
  if (tipo === "lluvia") return { x: Math.random() * (an + al * 0.4), y, vx: -1.2, vy: 4 + Math.random() * 3, r: 8 + Math.random() * 8, fase: 0 }
  if (tipo === "luz") return { x: Math.random() * an, y, vx: 0, vy: -(0.2 + Math.random() * 0.4), r: 1 + Math.random() * 1.8, fase: Math.random() * Math.PI * 2 }
  return { x: alAzar ? Math.random() * an : -120, y: Math.random() * al, vx: 0.15 + Math.random() * 0.25, vy: 0, r: 40 + Math.random() * 50, fase: 0 }
}

function mover(p: Particula, tipo: TipoClima, an: number, al: number) {
  p.x += p.vx
  p.y += p.vy
  p.fase += 0.03
  const fuera = tipo === "lluvia" ? p.y > al + 20 || p.x < -20 : tipo === "luz" ? p.y < -10 : p.x > an + 120
  if (fuera) Object.assign(p, crear(tipo, an, al, false))
}

function dibujar(ctx: CanvasRenderingContext2D, p: Particula, tipo: TipoClima) {
  if (tipo === "lluvia") {
    ctx.beginPath()
    ctx.moveTo(p.x, p.y)
    ctx.lineTo(p.x + p.vx * 3, p.y + p.r)
    ctx.stroke()
  } else if (tipo === "luz") {
    ctx.globalAlpha *= 0.6 + 0.4 * Math.sin(p.fase)
    ctx.beginPath()
    ctx.arc(p.x + Math.sin(p.fase) * 4, p.y, p.r, 0, Math.PI * 2)
    ctx.fill()
  } else {
    const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r)
    g.addColorStop(0, ctx.fillStyle as string)
    g.addColorStop(1, "transparent")
    const relleno = ctx.fillStyle
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = relleno
  }
}

/**
 * Partículas detrás del título según el clima de la ciudad seleccionada.
 * Se pausa con la pestaña oculta o la cabecera fuera de pantalla; no se dibuja con movimiento reducido.
 */
export function ClimaCabecera({ tipo }: { tipo: TipoClima | null }) {
  const lienzo = React.useRef<HTMLCanvasElement>(null)
  const reducido = useMovimientoReducido()
  // El bucle lee el tipo deseado de una ref: así cambiar de ciudad no reinicia la animación
  const deseado = React.useRef(tipo)
  const reanudarRef = React.useRef<() => void>(undefined)
  React.useEffect(() => {
    deseado.current = tipo
    reanudarRef.current?.()
  }, [tipo])

  React.useEffect(() => {
    const canvas = lienzo.current
    const ctx = canvas?.getContext("2d")
    if (!canvas || !ctx || reducido) return
    let an = 0
    let al = 0
    let actual: TipoClima | null = null
    let alfa = 0
    let particulas: Particula[] = []
    let marco = 0
    let visible = true
    let fotogramas = 0

    const ajustar = () => {
      const dpr = window.devicePixelRatio || 1
      an = canvas.clientWidth
      al = canvas.clientHeight
      canvas.width = an * dpr
      canvas.height = al * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    // El color del primario sale de `color` del propio canvas (clase text-primary): ya resuelto para el tema actual
    const leerColor = () => {
      const c = getComputedStyle(canvas).color
      ctx.fillStyle = c
      ctx.strokeStyle = c
      ctx.lineWidth = 1
    }

    const paso = () => {
      marco = 0
      if (!visible || document.hidden) return
      if (fotogramas++ % 60 === 0) leerColor()
      // Transición: se apaga, cambia de partículas y se vuelve a encender
      if (actual !== deseado.current) {
        alfa -= FUNDIDO
        if (alfa <= 0 || actual === null) {
          alfa = 0
          actual = deseado.current
          particulas = actual ? Array.from({ length: PARTICULAS[actual] }, () => crear(actual!, an, al)) : []
        }
      } else if (actual && alfa < 1) {
        alfa = Math.min(1, alfa + FUNDIDO)
      }
      ctx.clearRect(0, 0, an, al)
      // Sin datos y ya apagado: se detiene hasta que cambie la ciudad
      if (!actual && !deseado.current) return
      if (actual) {
        for (const p of particulas) {
          mover(p, actual, an, al)
          ctx.globalAlpha = OPACIDAD[actual] * alfa
          dibujar(ctx, p, actual)
        }
      }
      marco = requestAnimationFrame(paso)
    }
    const reanudar = () => {
      if (!marco && visible && !document.hidden) marco = requestAnimationFrame(paso)
    }

    reanudarRef.current = reanudar
    ajustar()
    leerColor()
    const medidor = new ResizeObserver(ajustar)
    medidor.observe(canvas)
    const observador = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting
      reanudar()
    })
    observador.observe(canvas)
    document.addEventListener("visibilitychange", reanudar)
    reanudar()
    return () => {
      reanudarRef.current = undefined
      cancelAnimationFrame(marco)
      medidor.disconnect()
      observador.disconnect()
      document.removeEventListener("visibilitychange", reanudar)
    }
  }, [reducido])

  if (reducido) return null
  return <canvas ref={lienzo} aria-hidden className="pointer-events-none absolute inset-0 -z-10 size-full text-primary" />
}
