/** Cálculos para el mapa y los gráficos, a partir de los registros válidos (en el navegador). */
import type { Medicion } from "@/lib/etl/tipos"

/** Resumen del periodo de una ciudad, calculado con sus registros válidos. */
export interface ResumenCiudad {
  registros: number
  temperaturaMedia: number
  humedadMedia: number
  precipitacionTotal: number
}

/** Medias y total del periodo por nombre de ciudad. */
export function resumirPorCiudad(validos: Medicion[]): Record<string, ResumenCiudad> {
  const resumenes: Record<string, ResumenCiudad> = {}
  for (const m of validos) {
    const r = (resumenes[m.ciudad] ??= { registros: 0, temperaturaMedia: 0, humedadMedia: 0, precipitacionTotal: 0 })
    r.registros++
    r.temperaturaMedia += m.temperatura_c
    r.humedadMedia += m.humedad_pct
    r.precipitacionTotal += m.precipitacion_mm
  }
  for (const r of Object.values(resumenes)) {
    r.temperaturaMedia /= r.registros
    r.humedadMedia /= r.registros
  }
  return resumenes
}

export interface TemperaturaDia {
  /** Día en UTC (AAAA-MM-DD). */
  dia: string
  /** Media diaria de la ciudad elegida; ausente si no tiene datos ese día. */
  ciudad?: number
  /** Media de las medias diarias de todas las ciudades con datos. */
  media: number
}

const redondear = (n: number) => Math.round(n * 10) / 10

/** Temperatura media diaria de una ciudad frente a la media de todas. */
export function temperaturaDiaria(validos: Medicion[], ciudad: string): TemperaturaDia[] {
  // dia → ciudad → [suma, n]
  const dias = new Map<string, Map<string, [number, number]>>()
  for (const m of validos) {
    const dia = m.fecha_hora.slice(0, 10)
    const porCiudad = dias.get(dia) ?? dias.set(dia, new Map()).get(dia)!
    const acc = porCiudad.get(m.ciudad) ?? [0, 0]
    porCiudad.set(m.ciudad, [acc[0] + m.temperatura_c, acc[1] + 1])
  }
  return [...dias.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dia, porCiudad]) => {
      const medias = [...porCiudad.values()].map(([s, n]) => s / n)
      const propia = porCiudad.get(ciudad)
      return {
        dia,
        ciudad: propia ? redondear(propia[0] / propia[1]) : undefined,
        media: redondear(medias.reduce((s, v) => s + v, 0) / medias.length),
      }
    })
}

type CampoNumerico = "temperatura_c" | "humedad_pct" | "precipitacion_mm"

/** Mínimo y máximo de un campo en los datos, redondeados hacia fuera al paso del slider (así los extremos no excluyen nada). */
export function limitesCampo(validos: Medicion[], campo: CampoNumerico, paso: number): [number, number] {
  if (!validos.length) return [0, 0]
  let min = Infinity
  let max = -Infinity
  for (const m of validos) {
    min = Math.min(min, m[campo])
    max = Math.max(max, m[campo])
  }
  const k = 1 / paso
  return [Math.floor(min * k) / k, Math.ceil(max * k) / k]
}
