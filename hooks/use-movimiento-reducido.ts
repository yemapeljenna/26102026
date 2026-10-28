"use client"

import * as React from "react"

const CONSULTA = "(prefers-reduced-motion: reduce)"

function suscribir(avisar: () => void) {
  const mq = window.matchMedia(CONSULTA)
  mq.addEventListener("change", avisar)
  return () => mq.removeEventListener("change", avisar)
}

/** true si el usuario pide menos movimiento (en el servidor, true: así nada se anima antes de saberlo). */
export function useMovimientoReducido(): boolean {
  return React.useSyncExternalStore(
    suscribir,
    () => window.matchMedia(CONSULTA).matches,
    () => true
  )
}
