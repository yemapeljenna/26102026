import type { RespuestaCarga, RespuestaVerificacion } from "./api-tipos"
import type { Lote, RespuestaEnvio } from "./carga"
import type { FilaCarga } from "./tipos"

async function postJson<T>(url: string, cuerpo: unknown): Promise<T | { ok: false; error: string }> {
  let r: Response
  try {
    r = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(cuerpo),
    })
  } catch {
    return { ok: false, error: "No se pudo contactar con el servidor de la aplicación." }
  }
  try {
    return (await r.json()) as T
  } catch {
    return { ok: false, error: `El servidor respondió HTTP ${r.status} sin JSON válido.` }
  }
}

export async function enviarLote(filas: FilaCarga[]): Promise<RespuestaEnvio> {
  const r = await postJson<RespuestaCarga>("/api/carga", { filas })
  if (!r.ok) {
    const detalles = "detalles" in r && r.detalles?.length ? ` ${r.detalles.join(" ")}` : ""
    return { ok: false, error: r.error + detalles }
  }
  return { ok: true, confirmadas: r.confirmadas }
}

export interface ResultadoVerificacion {
  comprobadas: number
  encontradas: number
  faltantes: { ciudad: string; fecha_hora: string }[]
  error?: string
}

/** Consulta, lote a lote, que las claves enviadas existen en la tabla destino. */
export async function verificarLotes(lotes: Lote[]): Promise<ResultadoVerificacion> {
  const res: ResultadoVerificacion = { comprobadas: 0, encontradas: 0, faltantes: [] }
  for (const l of lotes.filter((x) => x.estado === "completado")) {
    const r = await postJson<RespuestaVerificacion>("/api/verificar", {
      claves: l.filas.map((f) => ({ ciudad: f.ciudad, fecha_hora: f.fecha_hora })),
    })
    if (!r.ok) return { ...res, error: `Lote ${l.numero}: ${r.error}` }
    res.comprobadas += r.comprobadas
    res.encontradas += r.encontradas
    res.faltantes.push(...r.faltantes)
  }
  return res
}
