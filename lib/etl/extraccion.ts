import type { Ciudad } from "./ciudades"

export const URL_ARCHIVO_OPEN_METEO = "https://archive-api.open-meteo.com/v1/archive"
export const VARIABLES_HORARIAS = [
  "temperature_2m",
  "relative_humidity_2m",
  "precipitation",
] as const

export function construirUrl(ciudad: Ciudad, inicio: string, fin: string): string {
  const params = new URLSearchParams({
    latitude: String(ciudad.latitud),
    longitude: String(ciudad.longitud),
    start_date: inicio,
    end_date: fin,
    hourly: VARIABLES_HORARIAS.join(","),
    timezone: "UTC",
    temperature_unit: "celsius",
    precipitation_unit: "mm",
    timeformat: "iso8601",
  })
  return `${URL_ARCHIVO_OPEN_METEO}?${params}`
}

export type ResultadoPeticion =
  | { ok: true; json: unknown; duracionMs: number; estadoHttp: number }
  | { ok: false; error: string; duracionMs: number; estadoHttp?: number }

/** Descarga la respuesta de una ciudad. No transforma nada: devuelve el JSON tal cual. */
export async function descargarCiudad(
  ciudad: Ciudad,
  inicio: string,
  fin: string,
  fetchFn: typeof fetch = fetch
): Promise<ResultadoPeticion> {
  const t0 = performance.now()
  const duracion = () => Math.round(performance.now() - t0)
  let respuesta: Response
  try {
    respuesta = await fetchFn(construirUrl(ciudad, inicio, fin), {
      signal: AbortSignal.timeout(30_000),
    })
  } catch (e) {
    const causa =
      e instanceof DOMException && e.name === "TimeoutError"
        ? "tiempo de espera agotado (30 s)"
        : "no se pudo conectar con Open-Meteo"
    return { ok: false, error: `Error de red: ${causa}.`, duracionMs: duracion() }
  }

  let json: unknown
  try {
    json = await respuesta.json()
  } catch {
    return {
      ok: false,
      error: `Respuesta HTTP ${respuesta.status} que no es JSON válido.`,
      duracionMs: duracion(),
      estadoHttp: respuesta.status,
    }
  }

  if (!respuesta.ok) {
    const motivo =
      json && typeof json === "object" && "reason" in json
        ? String((json as { reason: unknown }).reason)
        : respuesta.statusText
    return {
      ok: false,
      error: `Open-Meteo respondió HTTP ${respuesta.status}: ${motivo}`,
      duracionMs: duracion(),
      estadoHttp: respuesta.status,
    }
  }
  return { ok: true, json, duracionMs: duracion(), estadoHttp: respuesta.status }
}
