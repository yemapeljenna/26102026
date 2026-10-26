import {
  claveMedicion,
  type Medicion,
  type RegistroRechazado,
  type RegistroTransformado,
} from "./tipos"
import { motivosRechazo } from "./validacion"

export interface ResultadoLimpieza {
  validos: Medicion[]
  rechazados: RegistroRechazado[]
  rechazadosCalidad: number
  duplicados: number
}

/**
 * 1. Valida cada registro y rechaza los que incumplen alguna regla de calidad.
 * 2. Elimina duplicados por (ciudad, fecha_hora) entre los registros válidos:
 *    se conserva la PRIMERA aparición en el orden de extracción (ciudad tras
 *    ciudad, hora tras hora) y las siguientes se rechazan como «duplicado».
 *    Deduplicar después de validar garantiza que un duplicado inválido no
 *    desplace a uno válido.
 */
export function limpiarRegistros(registros: RegistroTransformado[]): ResultadoLimpieza {
  const validos: Medicion[] = []
  const rechazados: RegistroRechazado[] = []
  const vistos = new Map<string, RegistroTransformado>()
  let rechazadosCalidad = 0
  let duplicados = 0

  for (const r of registros) {
    const motivos = motivosRechazo(r)
    if (motivos.length > 0) {
      rechazados.push({ registro: r, tipo: "calidad", motivos })
      rechazadosCalidad++
      continue
    }
    const fechaHora = r.fecha_hora as string
    const clave = claveMedicion(r.ciudad, fechaHora)
    const anterior = vistos.get(clave)
    if (anterior) {
      rechazados.push({
        registro: r,
        tipo: "duplicado",
        motivos: [
          `duplicado de ${r.ciudad} ${fechaHora}: se conserva la primera aparición (posición ${anterior.indice})`,
        ],
      })
      duplicados++
      continue
    }
    vistos.set(clave, r)
    validos.push({
      clave,
      ciudad: r.ciudad,
      fecha_hora: fechaHora,
      temperatura_c: r.temperatura_c as number,
      humedad_pct: r.humedad_pct as number,
      precipitacion_mm: r.precipitacion_mm as number,
    })
  }
  return { validos, rechazados, rechazadosCalidad, duplicados }
}
