import { limpiarRegistros, type ResultadoLimpieza } from "./limpieza"
import type { RegistroTransformado } from "./tipos"
import { transformarRespuesta } from "./transformacion"

export interface RespuestaCiudad {
  id: string
  nombre: string
  json: unknown
}

export interface ResultadoProcesado {
  transformados: RegistroTransformado[]
  incidencias: { ciudad: string; mensaje: string }[]
  limpieza: ResultadoLimpieza
  msTransformacion: number
  msLimpieza: number
}

/** Transformación y limpieza de todas las respuestas descargadas, midiendo cada fase. */
export function procesarRespuestas(respuestas: RespuestaCiudad[]): ResultadoProcesado {
  const t0 = performance.now()
  const transformados: RegistroTransformado[] = []
  const incidencias: ResultadoProcesado["incidencias"] = []
  for (const r of respuestas) {
    const t = transformarRespuesta(r.nombre, r.id, r.json)
    transformados.push(...t.registros)
    for (const mensaje of t.incidencias) incidencias.push({ ciudad: r.nombre, mensaje })
  }
  const t1 = performance.now()
  const limpieza = limpiarRegistros(transformados)
  const t2 = performance.now()
  return {
    transformados,
    incidencias,
    limpieza,
    msTransformacion: t1 - t0,
    msLimpieza: t2 - t1,
  }
}
