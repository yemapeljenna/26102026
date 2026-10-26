import { normalizarTimestamp } from "./fechas"

/** Comprueba que un valor es un número finito. Nunca convierte null, "" o ausentes en 0. */
export function motivoNoNumerico(valor: unknown, campo: string): string | null {
  if (valor === undefined) return `${campo}: valor ausente`
  if (valor === null) return `${campo}: valor null`
  if (typeof valor === "string") {
    return valor.trim() === ""
      ? `${campo}: cadena vacía`
      : `${campo}: es texto (${JSON.stringify(valor)}), se esperaba un número`
  }
  if (typeof valor !== "number") return `${campo}: tipo ${typeof valor}, se esperaba un número`
  if (!Number.isFinite(valor)) return `${campo}: número no finito (${valor})`
  return null
}

export interface ValoresMedicion {
  ciudad: unknown
  fecha_hora: unknown
  temperatura_c: unknown
  humedad_pct: unknown
  precipitacion_mm: unknown
}

/**
 * Reglas de calidad comunes a la limpieza (navegador) y a la API de carga (servidor).
 * Devuelve la lista de motivos de rechazo; vacía si el registro es válido.
 * No hay umbrales para la temperatura: los valores extremos son datos legítimos.
 */
export function motivosRechazo(v: ValoresMedicion): string[] {
  const motivos: string[] = []
  if (typeof v.ciudad !== "string" || v.ciudad.trim() === "") {
    motivos.push("ciudad: ausente o vacía")
  }
  if (typeof v.fecha_hora !== "string" || normalizarTimestamp(v.fecha_hora) === null) {
    motivos.push("fecha_hora: ausente o no válida")
  }
  const t = motivoNoNumerico(v.temperatura_c, "temperatura_c")
  const h = motivoNoNumerico(v.humedad_pct, "humedad_pct")
  const p = motivoNoNumerico(v.precipitacion_mm, "precipitacion_mm")
  if (t) motivos.push(t)
  if (h) motivos.push(h)
  else if ((v.humedad_pct as number) < 0 || (v.humedad_pct as number) > 100) {
    motivos.push(`humedad_pct: ${v.humedad_pct} fuera del rango 0–100`)
  }
  if (p) motivos.push(p)
  else if ((v.precipitacion_mm as number) < 0) {
    motivos.push(`precipitacion_mm: ${v.precipitacion_mm} es negativa`)
  }
  return motivos
}
