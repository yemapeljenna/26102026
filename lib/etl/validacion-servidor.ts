import { TAMANO_LOTE } from "./carga"
import { NOMBRES_CIUDADES } from "./ciudades"
import { claveMedicion, type FilaCarga } from "./tipos"
import { motivosRechazo } from "./validacion"

export const MAX_BYTES_PETICION = 256 * 1024
const RE_ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/
const CAMPOS_FILA = [
  "ciudad",
  "fecha_hora",
  "temperatura_c",
  "humedad_pct",
  "precipitacion_mm",
] as const

export type ResultadoValidacion<T> = { ok: true; valor: T } | { ok: false; errores: string[] }

/** Valida el cuerpo de una petición de carga: { filas: FilaCarga[] }. */
export function validarPeticionCarga(cuerpo: unknown): ResultadoValidacion<FilaCarga[]> {
  if (!cuerpo || typeof cuerpo !== "object" || !Array.isArray((cuerpo as { filas?: unknown }).filas)) {
    return { ok: false, errores: ["El cuerpo debe ser un objeto con un array «filas»."] }
  }
  const filas = (cuerpo as { filas: unknown[] }).filas
  if (filas.length === 0) return { ok: false, errores: ["El lote está vacío."] }
  if (filas.length > TAMANO_LOTE) {
    return { ok: false, errores: [`El lote tiene ${filas.length} filas; el máximo es ${TAMANO_LOTE}.`] }
  }

  const errores: string[] = []
  const claves = new Set<string>()
  filas.forEach((fila, i) => {
    const prefijo = `Fila ${i + 1}`
    if (!fila || typeof fila !== "object" || Array.isArray(fila)) {
      errores.push(`${prefijo}: no es un objeto.`)
      return
    }
    const f = fila as Record<string, unknown>
    const extra = Object.keys(f).filter((k) => !(CAMPOS_FILA as readonly string[]).includes(k))
    if (extra.length) errores.push(`${prefijo}: campos no permitidos (${extra.join(", ")}).`)
    for (const m of motivosRechazo(f as never)) errores.push(`${prefijo}: ${m}.`)
    if (typeof f.ciudad === "string" && !NOMBRES_CIUDADES.includes(f.ciudad)) {
      errores.push(`${prefijo}: ciudad «${f.ciudad}» no reconocida.`)
    }
    if (typeof f.fecha_hora === "string" && !RE_ISO_UTC.test(f.fecha_hora)) {
      errores.push(`${prefijo}: fecha_hora debe tener el formato AAAA-MM-DDTHH:MM:SSZ (UTC).`)
    }
    const clave = claveMedicion(String(f.ciudad), String(f.fecha_hora))
    if (claves.has(clave)) errores.push(`${prefijo}: clave (ciudad, fecha_hora) repetida dentro del lote.`)
    claves.add(clave)
  })
  if (errores.length) return { ok: false, errores: errores.slice(0, 20) }
  return { ok: true, valor: filas as FilaCarga[] }
}

export interface ClaveDestino {
  ciudad: string
  fecha_hora: string
}

/** Valida el cuerpo de una petición de verificación: { claves: ClaveDestino[] }. */
export function validarPeticionVerificacion(cuerpo: unknown): ResultadoValidacion<ClaveDestino[]> {
  const claves = (cuerpo as { claves?: unknown } | null)?.claves
  if (!Array.isArray(claves) || claves.length === 0) {
    return { ok: false, errores: ["El cuerpo debe incluir un array «claves» no vacío."] }
  }
  if (claves.length > TAMANO_LOTE) {
    return { ok: false, errores: [`Máximo ${TAMANO_LOTE} claves por verificación.`] }
  }
  for (const c of claves) {
    if (
      !c ||
      typeof c !== "object" ||
      typeof (c as ClaveDestino).ciudad !== "string" ||
      typeof (c as ClaveDestino).fecha_hora !== "string" ||
      !RE_ISO_UTC.test((c as ClaveDestino).fecha_hora)
    ) {
      return { ok: false, errores: ["Cada clave necesita «ciudad» y «fecha_hora» en UTC."] }
    }
  }
  return { ok: true, valor: claves as ClaveDestino[] }
}
