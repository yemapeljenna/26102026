import { describe, expect, it } from "vitest"

import { limitesCampo } from "@/lib/analisis"
import { CIUDADES } from "@/lib/etl/ciudades"
import { calcularSeleccion, filtrosIniciales, ORDEN_INICIAL } from "@/lib/etl/filtros"
import { procesarRespuestas } from "@/lib/etl/pipeline"

/** Respuesta sintética de Open-Meteo: septiembre completo (30 días × 24 h) sin huecos. */
function septiembre(semilla: number) {
  const time: string[] = []
  for (let d = 1; d <= 30; d++) for (let h = 0; h < 24; h++) time.push(`2026-09-${String(d).padStart(2, "0")}T${String(h).padStart(2, "0")}:00`)
  return {
    utc_offset_seconds: 0,
    hourly: {
      time,
      temperature_2m: time.map((_, i) => Math.round((15 + semilla + 8 * Math.sin(i / 4)) * 10) / 10),
      relative_humidity_2m: time.map((_, i) => 40 + ((i * 7 + semilla) % 55)),
      precipitation: time.map((_, i) => (i % 37 === 0 ? 1.3 : 0)),
    },
  }
}

describe("extracción de septiembre con las 5 ciudades", () => {
  const procesado = procesarRespuestas(CIUDADES.map((c, i) => ({ id: c.id, nombre: c.nombre, json: septiembre(i) })))
  const validos = procesado.limpieza.validos
  const nombres = CIUDADES.map((c) => c.nombre)
  const todas = new Set(validos.map((m) => m.clave))

  it("da 3600 registros válidos", () => {
    expect(procesado.transformados).toHaveLength(3600)
    expect(validos).toHaveLength(3600)
  })

  it("sin tocar los filtros (chips en «Todas», sliders en los extremos) no se filtra nada", () => {
    const sinTocar = calcularSeleccion(validos, filtrosIniciales(nombres), ORDEN_INICIAL, todas)
    expect(sinTocar.coincidentes).toHaveLength(3600)
    expect(sinTocar.paraCargar).toHaveLength(3600)
  })

  it("los sliders llevados a sus límites reales tampoco excluyen nada", () => {
    const [tMin, tMax] = limitesCampo(validos, "temperatura_c", 0.1)
    const [hMin, hMax] = limitesCampo(validos, "humedad_pct", 1)
    const [pMin, pMax] = limitesCampo(validos, "precipitacion_mm", 0.1)
    const filtros = {
      ...filtrosIniciales(nombres),
      temperaturaMin: String(tMin),
      temperaturaMax: String(tMax),
      humedadMin: String(hMin),
      humedadMax: String(hMax),
      precipitacionMin: String(pMin),
      precipitacionMax: String(pMax),
    }
    expect(calcularSeleccion(validos, filtros, ORDEN_INICIAL, todas).coincidentes).toHaveLength(3600)
  })

  it("sin datos, los límites son [0, 0]", () => {
    expect(limitesCampo([], "temperatura_c", 0.1)).toEqual([0, 0])
  })
})
