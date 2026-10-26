import { interpretarFechaHoraUtc } from "./fechas"
import type { RegistroTransformado } from "./tipos"

export interface ResultadoTransformacion {
  registros: RegistroTransformado[]
  /** Problemas estructurales detectados en la respuesta (no por fila). */
  incidencias: string[]
}

const CAMPOS = [
  ["temperature_2m", "temperatura_c"],
  ["relative_humidity_2m", "humedad_pct"],
  ["precipitation", "precipitacion_mm"],
] as const

/**
 * Convierte los arrays paralelos de `hourly` en un registro por hora.
 * No limpia ni corrige valores: null, cadenas vacías o huecos se conservan
 * para que la fase de limpieza los rechace con su motivo.
 */
export function transformarRespuesta(
  ciudad: string,
  idCiudad: string,
  json: unknown
): ResultadoTransformacion {
  const incidencias: string[] = []
  if (!json || typeof json !== "object") {
    return { registros: [], incidencias: ["La respuesta no es un objeto JSON."] }
  }
  const raiz = json as Record<string, unknown>

  const desfase = raiz.utc_offset_seconds
  const esUtc = desfase === 0
  if (!esUtc) {
    incidencias.push(
      `utc_offset_seconds es ${JSON.stringify(desfase)} en lugar de 0: las fechas no se pueden interpretar como UTC.`
    )
  }

  const hourly = raiz.hourly
  if (!hourly || typeof hourly !== "object") {
    return {
      registros: [],
      incidencias: [...incidencias, "La respuesta no contiene el objeto «hourly»."],
    }
  }
  const h = hourly as Record<string, unknown>
  if (!Array.isArray(h.time)) {
    return {
      registros: [],
      incidencias: [...incidencias, "«hourly.time» no es un array."],
    }
  }
  const tiempos = h.time as unknown[]

  const series = CAMPOS.map(([origen]) => {
    const valor = h[origen]
    if (!Array.isArray(valor)) {
      incidencias.push(`«hourly.${origen}» no existe o no es un array.`)
      return [] as unknown[]
    }
    if (valor.length !== tiempos.length) {
      incidencias.push(
        `Longitudes incoherentes: «${origen}» tiene ${valor.length} elementos y «time» ${tiempos.length}.`
      )
    }
    return valor as unknown[]
  })

  // Se recorre «time»: si otra serie es más corta, el hueco queda como undefined
  // (ausente) y la limpieza lo rechazará. Si es más larga, sobran valores sin hora.
  const registros = tiempos.map((t, i): RegistroTransformado => ({
    id: `${idCiudad}#${i}`,
    ciudad,
    indice: i,
    fecha_hora_origen: t,
    fecha_hora: esUtc ? interpretarFechaHoraUtc(t) : null,
    temperatura_c: series[0][i],
    humedad_pct: series[1][i],
    precipitacion_mm: series[2][i],
  }))
  return { registros, incidencias }
}
