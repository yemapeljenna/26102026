import { describe, expect, it } from "vitest"

import {
  calcularSeleccion,
  filtrosIniciales,
  ORDEN_INICIAL,
  paginar,
  type Filtros,
} from "@/lib/etl/filtros"
import { claveMedicion, type Medicion } from "@/lib/etl/tipos"

const CIUDADES = ["Barcelona", "Madrid"]

/** 2 ciudades × 48 horas = 96 mediciones deterministas. */
function mediciones(): Medicion[] {
  const out: Medicion[] = []
  for (const ciudad of CIUDADES) {
    for (let h = 0; h < 48; h++) {
      const fecha_hora = new Date(Date.UTC(2026, 8, 1, h)).toISOString().replace(".000Z", "Z")
      out.push({
        clave: claveMedicion(ciudad, fecha_hora),
        ciudad,
        fecha_hora,
        temperatura_c: ciudad === "Madrid" ? h : 100 - h,
        humedad_pct: h % 101,
        precipitacion_mm: h % 6 === 0 ? 0.5 : 0,
      })
    }
  }
  return out
}

const filtros = (cambios: Partial<Filtros> = {}) => ({ ...filtrosIniciales(CIUDADES), ...cambios })
const ninguna = new Set<string>()

describe("filtros y ordenación antes de paginar", () => {
  it("filtra y ordena el conjunto completo; la paginación solo recorta la vista", () => {
    const r = calcularSeleccion(
      mediciones(),
      filtros({ temperaturaMin: "40" }),
      { campo: "temperatura_c", direccion: "desc" },
      ninguna
    )
    // Barcelona: 100-h ≥ 40 → h ≤ 48 (48 horas); Madrid: h ≥ 40 → 8 horas.
    expect(r.coincidentes).toHaveLength(56)
    expect(r.coincidentes[0].temperatura_c).toBe(100)
    // La página 2 continúa el orden global, no reordena una página aislada.
    const p0 = paginar(r.coincidentes, 0, 25)
    const p1 = paginar(r.coincidentes, 1, 25)
    expect(p0.at(-1)!.temperatura_c).toBeGreaterThanOrEqual(p1[0].temperatura_c)
    const todas = [...p0, ...p1, ...paginar(r.coincidentes, 2, 25)]
    expect(todas).toEqual(r.coincidentes)
  })

  it("aplica ciudad, intervalo UTC, humedad, precipitación y solo lluvia", () => {
    const r = calcularSeleccion(
      mediciones(),
      filtros({
        ciudades: ["Madrid"],
        desde: "2026-09-01T06:00",
        hasta: "2026-09-02T06:00",
        humedadMax: "30",
        soloLluvia: true,
      }),
      ORDEN_INICIAL,
      ninguna
    )
    expect(r.coincidentes.map((m) => m.fecha_hora)).toEqual([
      "2026-09-01T06:00:00Z",
      "2026-09-01T12:00:00Z",
      "2026-09-01T18:00:00Z",
      "2026-09-02T00:00:00Z",
      "2026-09-02T06:00:00Z",
    ])
  })

  it("informa de límites no numéricos o invertidos", () => {
    const r = calcularSeleccion(mediciones(), filtros({ temperaturaMin: "abc", humedadMin: "50", humedadMax: "10" }), ORDEN_INICIAL, ninguna)
    expect(r.errores).toHaveLength(2)
    expect(r.coincidentes).toHaveLength(0)
  })

  it("orden ascendente y descendente por ciudad con desempate por fecha", () => {
    const asc = calcularSeleccion(mediciones(), filtros(), { campo: "ciudad", direccion: "asc" }, ninguna).coincidentes
    const desc = calcularSeleccion(mediciones(), filtros(), { campo: "ciudad", direccion: "desc" }, ninguna).coincidentes
    expect(asc[0].ciudad).toBe("Barcelona")
    expect(desc[0].ciudad).toBe("Madrid")
    expect(desc[0].fecha_hora).toBe("2026-09-01T00:00:00Z")
  })
})

describe("selección entre páginas", () => {
  it("«seleccionar todas las coincidentes» incluye filas de todas las páginas", () => {
    const datos = mediciones()
    const f = filtros({ ciudades: ["Barcelona"] })
    const { coincidentes } = calcularSeleccion(datos, f, ORDEN_INICIAL, ninguna)
    const seleccion = new Set(coincidentes.map((m) => m.clave)) // 48 filas, 2 páginas de 25
    const r = calcularSeleccion(datos, f, ORDEN_INICIAL, seleccion)
    expect(r.paraCargar).toHaveLength(48)
    expect(r.paraCargar).toEqual(coincidentes)
  })

  it("solo se suben las seleccionadas que siguen cumpliendo los filtros", () => {
    const datos = mediciones()
    const seleccion = new Set(datos.filter((m) => m.ciudad === "Madrid").map((m) => m.clave))
    const r = calcularSeleccion(datos, filtros({ desde: "2026-09-02T00:00" }), ORDEN_INICIAL, seleccion)
    expect(r.paraCargar).toHaveLength(24)
    expect(r.seleccionadosFueraDeFiltro).toBe(24)
    // Los filtros no añaden filas a la selección: Barcelona coincide pero no está seleccionada.
    expect(r.coincidentes).toHaveLength(48)
    expect(r.paraCargar.every((m) => m.ciudad === "Madrid")).toBe(true)
  })

  it("el conjunto para cargar respeta el orden elegido", () => {
    const datos = mediciones()
    const seleccion = new Set(datos.map((m) => m.clave))
    const r = calcularSeleccion(datos, filtros(), { campo: "temperatura_c", direccion: "asc" }, seleccion)
    const temps = r.paraCargar.map((m) => m.temperatura_c)
    expect(temps).toEqual([...temps].sort((a, b) => a - b))
  })
})
