import type { FilaCarga } from "./tipos"

export const TAMANO_LOTE = 500

export type EstadoLote = "pendiente" | "enviando" | "completado" | "error"

export interface Lote {
  numero: number
  filas: FilaCarga[]
  estado: EstadoLote
  /** Filas confirmadas por Supabase en la respuesta del upsert. */
  confirmadas?: number
  error?: string
  duracionMs?: number
  intentos: number
}

export function crearLotes(filas: FilaCarga[], tamano = TAMANO_LOTE): Lote[] {
  const lotes: Lote[] = []
  for (let i = 0; i < filas.length; i += tamano) {
    lotes.push({
      numero: lotes.length + 1,
      filas: filas.slice(i, i + tamano),
      estado: "pendiente",
      intentos: 0,
    })
  }
  return lotes
}

export type RespuestaEnvio =
  | { ok: true; confirmadas: number }
  | { ok: false; error: string }

export type EnviarLote = (filas: FilaCarga[]) => Promise<RespuestaEnvio>

/**
 * Envía, en orden y de uno en uno, los lotes pendientes o con error.
 * Los lotes completados no se reenvían. Un fallo no detiene los siguientes:
 * cada lote es un upsert independiente.
 */
export async function ejecutarLotes(
  lotes: Lote[],
  enviar: EnviarLote,
  alActualizar: (lotes: Lote[]) => void
): Promise<Lote[]> {
  let actuales = lotes.map((l) => ({ ...l }))
  const reemplazar = (numero: number, cambios: Partial<Lote>) => {
    actuales = actuales.map((l) => (l.numero === numero ? { ...l, ...cambios } : l))
    alActualizar(actuales)
  }

  for (const lote of lotes) {
    if (lote.estado === "completado") continue
    reemplazar(lote.numero, { estado: "enviando", error: undefined, intentos: lote.intentos + 1 })
    const t0 = performance.now()
    let r: RespuestaEnvio
    try {
      r = await enviar(lote.filas)
    } catch (e) {
      r = { ok: false, error: e instanceof Error ? e.message : String(e) }
    }
    const duracionMs = Math.round(performance.now() - t0)
    if (r.ok) {
      reemplazar(lote.numero, { estado: "completado", confirmadas: r.confirmadas, duracionMs })
    } else {
      reemplazar(lote.numero, { estado: "error", error: r.error, duracionMs, confirmadas: undefined })
    }
  }
  return actuales
}

export function resumenLotes(lotes: Lote[]) {
  const completados = lotes.filter((l) => l.estado === "completado")
  const fallidos = lotes.filter((l) => l.estado === "error")
  return {
    total: lotes.length,
    completados: completados.length,
    fallidos: fallidos.length,
    filasCorrectas: completados.reduce((s, l) => s + l.filas.length, 0),
    filasFallidas: fallidos.reduce((s, l) => s + l.filas.length, 0),
    filasConfirmadas: completados.reduce((s, l) => s + (l.confirmadas ?? 0), 0),
  }
}

/**
 * Huella del conjunto (número de filas + hash FNV-1a de claves y valores en orden).
 * Permite comprobar a simple vista que la vista previa y lo enviado son idénticos.
 */
export function huellaFilas(filas: FilaCarga[]): string {
  let h = 0x811c9dc5
  for (const f of filas) {
    const s = `${f.ciudad}|${f.fecha_hora}|${f.temperatura_c}|${f.humedad_pct}|${f.precipitacion_mm};`
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i)
      h = Math.imul(h, 0x01000193)
    }
  }
  return `${filas.length}·${(h >>> 0).toString(16).padStart(8, "0")}`
}
