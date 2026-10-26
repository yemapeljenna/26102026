import { describe, expect, it } from "vitest"

import { crearLotes, ejecutarLotes, huellaFilas, resumenLotes, type EnviarLote } from "@/lib/etl/carga"
import type { FilaCarga } from "@/lib/etl/tipos"
import { validarPeticionCarga, validarPeticionVerificacion } from "@/lib/etl/validacion-servidor"

function filas(n: number): FilaCarga[] {
  return Array.from({ length: n }, (_, i) => ({
    ciudad: "Bilbao",
    fecha_hora: new Date(Date.UTC(2026, 8, 1) + i * 3_600_000).toISOString().replace(".000Z", "Z"),
    temperatura_c: 15 + (i % 10),
    humedad_pct: 60,
    precipitacion_mm: 0,
  }))
}

describe("lotes", () => {
  it("divide en lotes de 500 como máximo conservando el orden", () => {
    const datos = filas(1203)
    const lotes = crearLotes(datos)
    expect(lotes.map((l) => l.filas.length)).toEqual([500, 500, 203])
    expect(lotes.flatMap((l) => l.filas)).toEqual(datos)
  })

  it("lo enviado coincide exactamente con la vista previa (misma huella)", async () => {
    const vistaPrevia = filas(730)
    const enviado: FilaCarga[] = []
    await ejecutarLotes(crearLotes(vistaPrevia), async (f) => {
      enviado.push(...f)
      return { ok: true, confirmadas: f.length }
    }, () => {})
    expect(enviado).toEqual(vistaPrevia)
    expect(huellaFilas(enviado)).toBe(huellaFilas(vistaPrevia))
  })

  it("la huella cambia si cambia el orden", () => {
    const a = filas(3)
    expect(huellaFilas(a)).not.toBe(huellaFilas([...a].reverse()))
  })

  it("un fallo parcial conserva los lotes correctos y el reintento solo reenvía los fallidos", async () => {
    const llamadas: number[] = []
    let fallarLote2 = true
    const enviar: EnviarLote = async (f) => {
      const n = f.length === 500 && f[0].fecha_hora === filas(1203)[500].fecha_hora ? 2 : f.length === 203 ? 3 : 1
      llamadas.push(n)
      if (n === 2 && fallarLote2) return { ok: false, error: "Error de Supabase (500): simulado" }
      return { ok: true, confirmadas: f.length }
    }

    const tras1 = await ejecutarLotes(crearLotes(filas(1203)), enviar, () => {})
    expect(tras1.map((l) => l.estado)).toEqual(["completado", "error", "completado"])
    expect(resumenLotes(tras1)).toMatchObject({ completados: 2, fallidos: 1, filasCorrectas: 703, filasFallidas: 500 })
    expect(tras1[1].error).toMatch(/simulado/)

    fallarLote2 = false
    llamadas.length = 0
    const tras2 = await ejecutarLotes(tras1, enviar, () => {})
    expect(llamadas).toEqual([2])
    expect(tras2.map((l) => l.estado)).toEqual(["completado", "completado", "completado"])
    expect(tras2[1].intentos).toBe(2)
    expect(resumenLotes(tras2).filasCorrectas).toBe(1203)
  })

  it("la carga trabaja sobre una copia congelada", async () => {
    const seleccion = filas(10)
    const congelada = [...seleccion]
    const lotes = crearLotes(congelada)
    seleccion.splice(0, 5) // el usuario cambia filtros/selección durante la carga
    const enviado: FilaCarga[] = []
    await ejecutarLotes(lotes, async (f) => (enviado.push(...f), { ok: true, confirmadas: f.length }), () => {})
    expect(enviado).toHaveLength(10)
  })

  it("una excepción de red marca el lote como error", async () => {
    const r = await ejecutarLotes(crearLotes(filas(2)), async () => {
      throw new Error("Failed to fetch")
    }, () => {})
    expect(r[0]).toMatchObject({ estado: "error", error: "Failed to fetch" })
  })
})

describe("validación en servidor", () => {
  it("acepta un lote correcto", () => {
    expect(validarPeticionCarga({ filas: filas(500) }).ok).toBe(true)
  })

  it("rechaza lotes vacíos, demasiado grandes o con claves repetidas", () => {
    expect(validarPeticionCarga({ filas: [] }).ok).toBe(false)
    expect(validarPeticionCarga({ filas: filas(501) }).ok).toBe(false)
    const rep = validarPeticionCarga({ filas: [...filas(1), ...filas(1)] })
    expect(rep.ok === false && rep.errores[0]).toMatch(/repetida/)
  })

  it("rechaza nulos, cadenas, rangos, ciudades desconocidas, campos extra y fechas sin Z", () => {
    const [f] = filas(1)
    const casos = [
      { ...f, temperatura_c: null },
      { ...f, temperatura_c: "" },
      { ...f, humedad_pct: 120 },
      { ...f, precipitacion_mm: -1 },
      { ...f, ciudad: "Atlántida" },
      { ...f, id: 7 },
      { ...f, fecha_hora: "2026-09-01T00:00:00+02:00" },
    ]
    for (const c of casos) expect(validarPeticionCarga({ filas: [c] }).ok, JSON.stringify(c)).toBe(false)
  })

  it("valida las claves de verificación", () => {
    expect(validarPeticionVerificacion({ claves: [{ ciudad: "Bilbao", fecha_hora: "2026-09-01T00:00:00Z" }] }).ok).toBe(true)
    expect(validarPeticionVerificacion({ claves: [] }).ok).toBe(false)
    expect(validarPeticionVerificacion({ claves: [{ ciudad: "Bilbao", fecha_hora: "ayer" }] }).ok).toBe(false)
  })
})
