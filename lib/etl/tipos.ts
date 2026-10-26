/** Registro tras convertir los arrays paralelos: todavía sin validar. */
export interface RegistroTransformado {
  /** Identificador estable dentro de la sesión: ciudad + posición en el array. */
  id: string
  ciudad: string
  /** Posición en los arrays de la respuesta original. */
  indice: number
  /** Valor tal cual llegó en hourly.time. */
  fecha_hora_origen: unknown
  /** fecha_hora_origen interpretada como UTC (ISO con Z), o null si no es válida. */
  fecha_hora: string | null
  /** Los valores se conservan sin convertir: null sigue siendo null. */
  temperatura_c: unknown
  humedad_pct: unknown
  precipitacion_mm: unknown
}

/** Registro válido y normalizado, listo para filtrar y cargar. */
export interface Medicion {
  /** Clave natural: ciudad|fecha_hora (coincide con la restricción única). */
  clave: string
  ciudad: string
  fecha_hora: string
  temperatura_c: number
  humedad_pct: number
  precipitacion_mm: number
}

export type TipoRechazo = "calidad" | "duplicado"

export interface RegistroRechazado {
  registro: RegistroTransformado
  tipo: TipoRechazo
  motivos: string[]
}

/** Fila exacta que se envía a Supabase. */
export interface FilaCarga {
  ciudad: string
  fecha_hora: string
  temperatura_c: number
  humedad_pct: number
  precipitacion_mm: number
}

export function claveMedicion(ciudad: string, fechaHora: string): string {
  return `${ciudad}|${fechaHora}`
}

export function aFilaCarga(m: Medicion): FilaCarga {
  return {
    ciudad: m.ciudad,
    fecha_hora: m.fecha_hora,
    temperatura_c: m.temperatura_c,
    humedad_pct: m.humedad_pct,
    precipitacion_mm: m.precipitacion_mm,
  }
}
