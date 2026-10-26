import { describe, expect, it } from "vitest"

import { CIUDADES } from "@/lib/etl/ciudades"
import { descargarCiudad } from "@/lib/etl/extraccion"
import { procesarRespuestas } from "@/lib/etl/pipeline"

describe("Open-Meteo (API real)", () => {
  it("una ciudad durante un día devuelve 24 registros horarios en UTC", async () => {
    const barcelona = CIUDADES[0]
    const r = await descargarCiudad(barcelona, "2026-09-01", "2026-09-01")
    expect(r.ok).toBe(true)
    if (!r.ok) return

    expect((r.json as { utc_offset_seconds: number }).utc_offset_seconds).toBe(0)
    const p = procesarRespuestas([{ id: barcelona.id, nombre: barcelona.nombre, json: r.json }])
    expect(p.incidencias).toEqual([])
    expect(p.transformados).toHaveLength(24)
    expect(p.transformados.map((t) => t.fecha_hora)).toEqual(
      Array.from({ length: 24 }, (_, h) => `2026-09-01T${String(h).padStart(2, "0")}:00:00Z`)
    )
    expect(p.limpieza.validos).toHaveLength(24)
  })

  it("informa del error de la API ante un rango imposible", async () => {
    const r = await descargarCiudad(CIUDADES[1], "2026-09-01", "2026-09-40")
    expect(r).toMatchObject({ ok: false, estadoHttp: 400 })
  })
})
