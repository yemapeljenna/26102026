export const MAX_DIAS_EXTRACCION = 31
export const FECHA_MINIMA_ARCHIVO = "1940-01-01"
/** El archivo de Open-Meteo publica los datos con unos días de retraso. */
export const DIAS_RETRASO_ARCHIVO = 5

const MS_DIA = 86_400_000
const RE_FECHA = /^(\d{4})-(\d{2})-(\d{2})$/
const RE_FECHA_HORA =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?(Z|\+00:00)?$/

/** Convierte "AAAA-MM-DD" a milisegundos UTC; null si no es una fecha real. */
export function fechaUtcMs(fecha: string): number | null {
  const m = RE_FECHA.exec(fecha)
  if (!m) return null
  const [a, mes, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const ms = Date.UTC(a, mes - 1, d)
  const f = new Date(ms)
  if (
    f.getUTCFullYear() !== a ||
    f.getUTCMonth() !== mes - 1 ||
    f.getUTCDate() !== d
  ) {
    return null
  }
  return ms
}

/**
 * Interpreta explícitamente como UTC una fecha y hora de Open-Meteo
 * ("2026-09-01T00:00", sin zona porque se solicitó timezone=UTC).
 * Devuelve ISO 8601 con sufijo Z ("2026-09-01T00:00:00Z") o null si no es válida.
 */
export function interpretarFechaHoraUtc(valor: unknown): string | null {
  if (typeof valor !== "string") return null
  const m = RE_FECHA_HORA.exec(valor.trim())
  if (!m) return null
  const [a, mes, d, h, min, s] = [1, 2, 3, 4, 5, 6].map((i) => Number(m[i] ?? 0))
  if (h > 23 || min > 59 || s > 59) return null
  const ms = Date.UTC(a, mes - 1, d, h, min, s)
  const f = new Date(ms)
  if (
    f.getUTCFullYear() !== a ||
    f.getUTCMonth() !== mes - 1 ||
    f.getUTCDate() !== d
  ) {
    return null
  }
  return f.toISOString().replace(".000Z", "Z")
}

/** Normaliza cualquier timestamp (p. ej. "2026-09-01T00:00:00+00:00" de Postgres) a "…Z". */
export function normalizarTimestamp(valor: string): string | null {
  const ms = Date.parse(valor)
  if (Number.isNaN(ms)) return null
  return new Date(ms).toISOString().replace(".000Z", "Z")
}

export function hoyUtc(ahora: Date = new Date()): string {
  return ahora.toISOString().slice(0, 10)
}

export function diasInclusivos(inicio: string, fin: string): number | null {
  const a = fechaUtcMs(inicio)
  const b = fechaUtcMs(fin)
  if (a === null || b === null) return null
  return Math.round((b - a) / MS_DIA) + 1
}

export interface ValidacionRango {
  errores: string[]
  avisos: string[]
  dias: number | null
}

export function validarRango(
  inicio: string,
  fin: string,
  ahora: Date = new Date()
): ValidacionRango {
  const errores: string[] = []
  const avisos: string[] = []
  const a = fechaUtcMs(inicio)
  const b = fechaUtcMs(fin)
  if (a === null) errores.push("La fecha inicial no es válida.")
  if (b === null) errores.push("La fecha final no es válida.")
  if (a === null || b === null) return { errores, avisos, dias: null }

  const dias = Math.round((b - a) / MS_DIA) + 1
  const hoy = fechaUtcMs(hoyUtc(ahora))!
  if (a < fechaUtcMs(FECHA_MINIMA_ARCHIVO)!) {
    errores.push("El archivo histórico empieza el 01/01/1940.")
  }
  if (b < a) {
    errores.push("La fecha final debe ser igual o posterior a la inicial.")
  } else if (dias > MAX_DIAS_EXTRACCION) {
    errores.push(
      `El periodo tiene ${dias} días; el máximo por extracción es ${MAX_DIAS_EXTRACCION}.`
    )
  }
  if (b > hoy) {
    errores.push("La fecha final no puede ser posterior a hoy (UTC).")
  } else if (b > hoy - DIAS_RETRASO_ARCHIVO * MS_DIA) {
    avisos.push(
      `Los últimos ${DIAS_RETRASO_ARCHIVO} días pueden no estar publicados aún: es probable que aparezcan valores null, que se rechazarán en la limpieza.`
    )
  }
  return { errores, avisos, dias: errores.length ? null : dias }
}

export function formatearFechaHora(iso: string): string {
  // "2026-09-01T00:00:00Z" → "2026-09-01 00:00 UTC"
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`
}
