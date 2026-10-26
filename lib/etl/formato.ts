const enteros = new Intl.NumberFormat("es-ES")
const decimales = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2 })

export function formatoEntero(n: number): string {
  return enteros.format(n)
}

export function formatoNumero(n: number): string {
  return decimales.format(n)
}

export function formatoDuracion(ms: number | undefined): string {
  if (ms === undefined) return "—"
  if (ms < 1) return "< 1 ms"
  if (ms < 1000) return `${Math.round(ms)} ms`
  return `${decimales.format(ms / 1000)} s`
}

/** Describe un valor bruto sin disfrazarlo: null, "" y ausentes se ven como tales. */
export function describirValorBruto(v: unknown): { texto: string; especial: boolean } {
  if (v === undefined) return { texto: "(ausente)", especial: true }
  if (v === null) return { texto: "null", especial: true }
  if (typeof v === "string") return { texto: v === "" ? '"" (vacía)' : JSON.stringify(v), especial: true }
  if (typeof v === "number") return { texto: formatoNumero(v), especial: !Number.isFinite(v) }
  return { texto: JSON.stringify(v), especial: true }
}
