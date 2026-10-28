"use client"

import * as React from "react"

import { useMovimientoReducido } from "@/hooks/use-movimiento-reducido"

const DURACION_MS = 800
const SIN_ANIMAR = Symbol("sin-animar")

/**
 * Número que sube de 0 a su valor en ~800 ms al montarse y cada vez que cambia `datos` (nuevos datos).
 * Si solo cambia el valor (filtros, métrica), salta directamente. Sin animación con movimiento reducido.
 */
export function ValorAnimado({ valor, datos, formato }: { valor: number; datos: unknown; formato: (n: number) => string }) {
  const reducido = useMovimientoReducido()
  const [mostrado, setMostrado] = React.useState<number | null>(null)
  const datosAnimados = React.useRef<unknown>(SIN_ANIMAR)

  React.useEffect(() => {
    if (reducido || datosAnimados.current === datos || valor === 0) {
      datosAnimados.current = datos
      return
    }
    const t0 = performance.now()
    let marco = 0
    const paso = (t: number) => {
      // Se marca en el primer fotograma: si el efecto se limpia antes (StrictMode), la animación se repite entera
      datosAnimados.current = datos
      const p = Math.min(1, (t - t0) / DURACION_MS)
      // Frenada suave al final; los enteros siguen siendo enteros mientras suben
      const x = valor * (1 - (1 - p) ** 3)
      setMostrado(p < 1 ? (Number.isInteger(valor) ? Math.round(x) : Math.round(x * 10) / 10) : null)
      if (p < 1) marco = requestAnimationFrame(paso)
    }
    marco = requestAnimationFrame(paso)
    return () => {
      cancelAnimationFrame(marco)
      setMostrado(null)
    }
  }, [datos, valor, reducido])

  return <>{formato(mostrado ?? valor)}</>
}
