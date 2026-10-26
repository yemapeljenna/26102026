import { describe, expect, it } from "vitest"

import { limpiarRegistros } from "@/lib/etl/limpieza"
import { procesarRespuestas } from "@/lib/etl/pipeline"
import { transformarRespuesta } from "@/lib/etl/transformacion"
import {
  respuestaConDuplicado,
  respuestaConProblemas,
  respuestaFechaInvalida,
  respuestaLongitudesIncoherentes,
  respuestaNoUtc,
  respuestaUnDia,
} from "./fixtures/open-meteo"

describe("transformación de arrays paralelos", () => {
  it("convierte un día en 24 registros horarios en UTC", () => {
    const { registros, incidencias } = transformarRespuesta("Barcelona", "barcelona", respuestaUnDia)
    expect(incidencias).toEqual([])
    expect(registros).toHaveLength(24)
    expect(registros[0]).toMatchObject({
      ciudad: "Barcelona",
      indice: 0,
      fecha_hora_origen: "2026-09-01T00:00",
      fecha_hora: "2026-09-01T00:00:00Z",
      temperatura_c: 20,
      humedad_pct: 50,
      precipitacion_mm: 0,
    })
    expect(registros[23].fecha_hora).toBe("2026-09-01T23:00:00Z")
    expect(registros[5].precipitacion_mm).toBe(1.2)
    // Cada posición i de los arrays acaba en el registro i.
    registros.forEach((r, i) => expect(r.temperatura_c).toBe(respuestaUnDia.hourly.temperature_2m[i]))
  })

  it("conserva null y cadenas vacías sin convertirlos en cero", () => {
    const { registros } = transformarRespuesta("Madrid", "madrid", respuestaConProblemas)
    expect(registros[1].temperatura_c).toBeNull()
    expect(registros[3].temperatura_c).toBe("")
    expect(registros[4].precipitacion_mm).toBeNull()
  })

  it("detecta longitudes incoherentes y deja el hueco como ausente", () => {
    const { registros, incidencias } = transformarRespuesta("Bilbao", "bilbao", respuestaLongitudesIncoherentes)
    expect(incidencias.join(" ")).toMatch(/relative_humidity_2m.*3.*4/)
    expect(registros).toHaveLength(4)
    expect(registros[3].humedad_pct).toBeUndefined()
  })

  it("no interpreta fechas si la respuesta no está en UTC", () => {
    const { registros, incidencias } = transformarRespuesta("Sevilla", "sevilla", respuestaNoUtc)
    expect(incidencias[0]).toMatch(/utc_offset_seconds/)
    expect(registros.every((r) => r.fecha_hora === null)).toBe(true)
  })

  it("rechaza estructuras sin hourly", () => {
    const r = transformarRespuesta("X", "x", { error: true })
    expect(r.registros).toEqual([])
    expect(r.incidencias.join(" ")).toMatch(/hourly/)
  })
})

describe("limpieza", () => {
  it("acepta un día correcto completo", () => {
    const { registros } = transformarRespuesta("Barcelona", "barcelona", respuestaUnDia)
    const r = limpiarRegistros(registros)
    expect(r.validos).toHaveLength(24)
    expect(r.rechazados).toHaveLength(0)
    expect(r.validos[0].clave).toBe("Barcelona|2026-09-01T00:00:00Z")
  })

  it("rechaza cada problema de calidad con su motivo y no descarta temperaturas extremas", () => {
    const { registros } = transformarRespuesta("Madrid", "madrid", respuestaConProblemas)
    const r = limpiarRegistros(registros)
    const motivos = Object.fromEntries(r.rechazados.map((x) => [x.registro.indice, x.motivos.join("; ")]))

    expect(r.validos.map((v) => v.fecha_hora)).toEqual(["2026-09-02T00:00:00Z"])
    expect(motivos[1]).toBe("temperatura_c: valor null")
    expect(motivos[2]).toMatch(/humedad_pct: 101 fuera del rango/)
    expect(motivos[3]).toMatch(/temperatura_c: cadena vacía/)
    expect(motivos[3]).toMatch(/precipitacion_mm: -0.1 es negativa/)
    // -45,3 °C es extremo pero se acepta; esa fila cae solo por la precipitación null.
    expect(motivos[4]).toBe("precipitacion_mm: valor null")
    expect(motivos[5]).toMatch(/humedad_pct: es texto \("80"\)/)
    expect(r.rechazados.every((x) => x.tipo === "calidad")).toBe(true)
  })

  it("acepta temperaturas extremas si el resto es válido", () => {
    const r = limpiarRegistros([
      { id: "a", ciudad: "Sevilla", indice: 0, fecha_hora_origen: "", fecha_hora: "2026-09-01T00:00:00Z", temperatura_c: 52.7, humedad_pct: 5, precipitacion_mm: 0 },
      { id: "b", ciudad: "Bilbao", indice: 0, fecha_hora_origen: "", fecha_hora: "2026-09-01T00:00:00Z", temperatura_c: -30, humedad_pct: 100, precipitacion_mm: 0 },
    ])
    expect(r.validos).toHaveLength(2)
  })

  it("rechaza ausentes y fechas no válidas", () => {
    const inc = limpiarRegistros(transformarRespuesta("Bilbao", "bilbao", respuestaLongitudesIncoherentes).registros)
    expect(inc.rechazados[0].motivos).toEqual(["humedad_pct: valor ausente"])

    const fechas = limpiarRegistros(transformarRespuesta("Valencia", "valencia", respuestaFechaInvalida).registros)
    expect(fechas.validos).toHaveLength(0)
    expect(fechas.rechazados.map((x) => x.motivos[0])).toEqual([
      "fecha_hora: ausente o no válida",
      "fecha_hora: ausente o no válida",
    ])
  })

  it("elimina duplicados conservando la primera aparición y los separa de la calidad", () => {
    const r = limpiarRegistros(transformarRespuesta("Valencia", "valencia", respuestaConDuplicado).registros)
    expect(r.validos).toHaveLength(3)
    expect(r.validos.find((v) => v.fecha_hora === "2026-09-04T01:00:00Z")?.temperatura_c).toBe(16)
    expect(r.duplicados).toBe(1)
    expect(r.rechazadosCalidad).toBe(0)
    expect(r.rechazados[0]).toMatchObject({ tipo: "duplicado" })
    expect(r.rechazados[0].motivos[0]).toMatch(/primera aparición \(posición 1\)/)
  })

  it("la misma hora en ciudades distintas no es duplicado", () => {
    const p = procesarRespuestas([
      { id: "barcelona", nombre: "Barcelona", json: respuestaUnDia },
      { id: "madrid", nombre: "Madrid", json: respuestaUnDia },
    ])
    expect(p.transformados).toHaveLength(48)
    expect(p.limpieza.validos).toHaveLength(48)
    expect(p.limpieza.duplicados).toBe(0)
  })
})
