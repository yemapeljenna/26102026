/**
 * Requiere `npm run dev` en marcha, .env.local configurado y la migración aplicada.
 * Usa datos reales de Open-Meteo (Bilbao, 2026-09-02) y escribe en la tabla destino.
 */
import { beforeAll, describe, expect, it } from "vitest"

import type { RespuestaCarga, RespuestaMediciones, RespuestaVerificacion } from "@/lib/etl/api-tipos"
import { crearLotes, ejecutarLotes, resumenLotes, type EnviarLote } from "@/lib/etl/carga"
import { CIUDADES } from "@/lib/etl/ciudades"
import { descargarCiudad } from "@/lib/etl/extraccion"
import { procesarRespuestas } from "@/lib/etl/pipeline"
import { aFilaCarga, type FilaCarga } from "@/lib/etl/tipos"

const BASE = process.env.ETL_APP_URL ??"http://localhost:3000"
const DIA = "2026-09-02"
const bilbao = CIUDADES.find((c) => c.id === "bilbao")!

async function post<T>(ruta: string, cuerpo: unknown): Promise<T> {
  const r = await fetch(BASE + ruta, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(cuerpo) })
  return (await r.json()) as T
}

const enviar: EnviarLote = async (filas) => {
  const r = await post<RespuestaCarga>("/api/carga", { filas })
  return r.ok ? { ok: true, confirmadas: r.confirmadas } : { ok: false, error: r.error + " " + (r.detalles ?? []).join(" ") }
}

async function totalDelDia(): Promise<number> {
  const r = (await (await fetch(`${BASE}/api/mediciones?ciudad=Bilbao&desde=${DIA}&hasta=${DIA}`)).json()) as RespuestaMediciones
  if (!r.ok) throw new Error(r.error)
  return r.total
}

let filas: FilaCarga[] = []

beforeAll(async () => {
  const estado = await (await fetch(`${BASE}/api/estado`)).json()
  if (!estado.tablaDisponible) throw new Error(`Integración no disponible: ${estado.mensaje}`)
  const d = await descargarCiudad(bilbao, DIA, DIA)
  if (!d.ok) throw new Error(d.error)
  filas = procesarRespuestas([{ id: bilbao.id, nombre: bilbao.nombre, json: d.json }]).limpieza.validos.map(aFilaCarga)
  expect(filas).toHaveLength(24)
})

describe("carga en Supabase (integración real)", () => {
  it("carga 24 filas y las verifica en destino", async () => {
    const lotes = await ejecutarLotes(crearLotes(filas), enviar, () => {})
    expect(resumenLotes(lotes)).toMatchObject({ completados: 1, filasCorrectas: 24, filasConfirmadas: 24 })
    const v = await post<RespuestaVerificacion>("/api/verificar", { claves: filas.map(({ ciudad, fecha_hora }) => ({ ciudad, fecha_hora })) })
    expect(v).toMatchObject({ ok: true, comprobadas: 24, encontradas: 24, faltantes: [] })
    expect(await totalDelDia()).toBe(24)
  })

  it("una segunda carga no duplica filas", async () => {
    await ejecutarLotes(crearLotes(filas), enviar, () => {})
    expect(await totalDelDia()).toBe(24)
  })

  it("fallo parcial: el lote inválido falla, el resto se conserva y el reintento solo envía el fallido", async () => {
    const corrupta = [...filas]
    corrupta[20] = { ...corrupta[20], humedad_pct: 150 } // rechazada por la validación del servidor
    const enviados: number[] = []
    const espia: EnviarLote = async (f) => (enviados.push(f.length), enviar(f))

    const tras1 = await ejecutarLotes(crearLotes(corrupta, 10), espia, () => {})
    expect(tras1.map((l) => l.estado)).toEqual(["completado", "completado", "error"])
    expect(tras1[2].error).toMatch(/humedad_pct: 150 fuera del rango/)

    // Se corrige el dato y se reintenta solo el lote 3.
    const reparado = tras1.map((l) => (l.numero === 3 ? { ...l, filas: filas.slice(20) } : l))
    enviados.length = 0
    const tras2 = await ejecutarLotes(reparado, espia, () => {})
    expect(enviados).toEqual([4])
    expect(resumenLotes(tras2)).toMatchObject({ fallidos: 0, filasCorrectas: 24 })
    expect(await totalDelDia()).toBe(24)
  })

  it("rechaza en servidor peticiones demasiado grandes", async () => {
    const r = await fetch(BASE + "/api/carga", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ filas: Array.from({ length: 501 }, () => filas[0]) }),
    })
    expect(r.status).toBe(422)
  })
})
