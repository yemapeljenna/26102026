import { obtenerSupabase } from "./servidor"
import { MAX_BYTES_PETICION } from "@/lib/etl/validacion-servidor"

/**
 * El proyecto no tiene autenticación: los endpoints de escritura solo se
 * habilitan en desarrollo. Para publicarlos hay que añadir autenticación y
 * definir ETL_PERMITIR_EN_PRODUCCION=true conscientemente.
 */
export function comprobarEntorno(): Response | null {
  if (
    process.env.NODE_ENV === "production" &&
    process.env.ETL_PERMITIR_EN_PRODUCCION !== "true"
  ) {
    return errorJson(
      403,
      "Endpoint deshabilitado en producción: la aplicación no tiene autenticación. Consulta el README."
    )
  }
  return null
}

export function errorJson(estado: number, error: string, detalles?: string[]) {
  return Response.json({ ok: false, error, detalles }, { status: estado })
}

/** Lee el cuerpo JSON respetando un tamaño máximo. */
export async function leerJsonLimitado(
  request: Request
): Promise<{ ok: true; cuerpo: unknown } | { ok: false; respuesta: Response }> {
  const declarado = Number(request.headers.get("content-length") ?? "0")
  if (declarado > MAX_BYTES_PETICION) {
    return { ok: false, respuesta: errorJson(413, `La petición supera ${MAX_BYTES_PETICION} bytes.`) }
  }
  const texto = await request.text()
  if (new TextEncoder().encode(texto).length > MAX_BYTES_PETICION) {
    return { ok: false, respuesta: errorJson(413, `La petición supera ${MAX_BYTES_PETICION} bytes.`) }
  }
  try {
    return { ok: true, cuerpo: JSON.parse(texto) }
  } catch {
    return { ok: false, respuesta: errorJson(400, "El cuerpo no es JSON válido.") }
  }
}

export function clienteOError() {
  const config = obtenerSupabase()
  if (!config.ok) return { cliente: null, respuesta: errorJson(503, config.motivo) }
  return { cliente: config.cliente, respuesta: null }
}

/** Traduce errores de PostgREST a mensajes en castellano sin exponer credenciales. */
export function mensajeErrorSupabase(e: { code?: string; message?: string }): string {
  if (e.code === "PGRST205" || e.code === "42P01") {
    return "La tabla mediciones_meteorologicas no existe. Ejecuta la migración de supabase/migrations."
  }
  if (e.code === "23514") return `Restricción de la tabla incumplida: ${e.message}`
  if (e.message?.toLowerCase().includes("invalid api key")) {
    return "Supabase rechazó la clave secreta (SUPABASE_SECRET_KEY)."
  }
  return `Error de Supabase${e.code ? ` (${e.code})` : ""}: ${e.message ?? "desconocido"}`
}
