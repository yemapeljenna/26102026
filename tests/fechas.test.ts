import { describe, expect, it } from "vitest"

import { interpretarFechaHoraUtc, validarRango } from "@/lib/etl/fechas"
import { construirUrl } from "@/lib/etl/extraccion"
import { CIUDADES } from "@/lib/etl/ciudades"

const HOY = new Date("2026-10-26T10:00:00Z")

describe("fechas", () => {
  it("interpreta las horas de Open-Meteo como UTC", () => {
    expect(interpretarFechaHoraUtc("2026-09-01T00:00")).toBe("2026-09-01T00:00:00Z")
    expect(interpretarFechaHoraUtc("2026-09-01T23:00")).toBe("2026-09-01T23:00:00Z")
    expect(interpretarFechaHoraUtc("2026-02-30T00:00")).toBeNull()
    expect(interpretarFechaHoraUtc("2026-09-01T24:00")).toBeNull()
    expect(interpretarFechaHoraUtc("2026-09-01T00:00+02:00")).toBeNull()
    expect(interpretarFechaHoraUtc(null)).toBeNull()
  })

  it("acepta septiembre de 2026 (30 días)", () => {
    expect(validarRango("2026-09-01", "2026-09-30", HOY)).toEqual({ errores: [], avisos: [], dias: 30 })
  })

  it("limita a 31 días y valida el orden y el futuro", () => {
    expect(validarRango("2026-08-01", "2026-08-31", HOY).dias).toBe(31)
    expect(validarRango("2026-08-01", "2026-09-01", HOY).errores[0]).toMatch(/32 días/)
    expect(validarRango("2026-09-10", "2026-09-01", HOY).errores[0]).toMatch(/posterior a la inicial/)
    expect(validarRango("2026-10-20", "2026-10-27", HOY).errores[0]).toMatch(/posterior a hoy/)
    expect(validarRango("2026-10-20", "2026-10-25", HOY).avisos).toHaveLength(1)
  })

  it("solicita UTC, °C y mm", () => {
    const url = new URL(construirUrl(CIUDADES[0], "2026-09-01", "2026-09-01"))
    expect(url.origin + url.pathname).toBe("https://archive-api.open-meteo.com/v1/archive")
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      latitude: "41.3874",
      longitude: "2.1686",
      hourly: "temperature_2m,relative_humidity_2m,precipitation",
      timezone: "UTC",
      temperature_unit: "celsius",
      precipitation_unit: "mm",
    })
  })
})
