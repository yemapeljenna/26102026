import type { NextRequest } from "next/server"

import {
  clienteOError,
  comprobarEntorno,
  errorJson,
  mensajeErrorSupabase,
} from "@/lib/supabase/api"
import { TABLA_MEDICIONES } from "@/lib/supabase/servidor"
import { NOMBRES_CIUDADES } from "@/lib/etl/ciudades"
import { fechaUtcMs } from "@/lib/etl/fechas"

const COLUMNAS_ORDEN = [
  "ciudad",
  "fecha_hora",
  "temperatura_c",
  "humedad_pct",
  "precipitacion_mm",
  "importado_en",
] as const
const MAX_TAMANO = 100

/** Lectura paginada de lo que realmente está guardado en Supabase. */
export async function GET(request: NextRequest) {
  const bloqueo = comprobarEntorno()
  if (bloqueo) return bloqueo

  const p = request.nextUrl.searchParams
  const ciudad = p.get("ciudad") ?? ""
  const desde = p.get("desde") ?? ""
  const hasta = p.get("hasta") ?? ""
  const orden = p.get("orden") ?? "fecha_hora"
  const direccion = p.get("direccion") === "desc" ? "desc" : "asc"
  const pagina = Math.max(0, Math.floor(Number(p.get("pagina") ?? "0")) || 0)
  const tamano = Math.min(MAX_TAMANO, Math.max(1, Math.floor(Number(p.get("tamano") ?? "25")) || 25))

  if (ciudad && !NOMBRES_CIUDADES.includes(ciudad)) return errorJson(400, "Ciudad no reconocida.")
  if (desde && fechaUtcMs(desde) === null) return errorJson(400, "Fecha «desde» no válida.")
  if (hasta && fechaUtcMs(hasta) === null) return errorJson(400, "Fecha «hasta» no válida.")
  if (!(COLUMNAS_ORDEN as readonly string[]).includes(orden)) return errorJson(400, "Columna de orden no válida.")

  const { cliente, respuesta } = clienteOError()
  if (!cliente) return respuesta

  let consulta = cliente
    .from(TABLA_MEDICIONES)
    .select("id, ciudad, fecha_hora, temperatura_c, humedad_pct, precipitacion_mm, importado_en", {
      count: "exact",
    })
  if (ciudad) consulta = consulta.eq("ciudad", ciudad)
  if (desde) consulta = consulta.gte("fecha_hora", `${desde}T00:00:00Z`)
  // «hasta» incluye el día completo.
  if (hasta) consulta = consulta.lt("fecha_hora", new Date(fechaUtcMs(hasta)! + 86_400_000).toISOString())

  const { data, count, error } = await consulta
    .order(orden, { ascending: direccion === "asc" })
    .order("ciudad")
    .order("fecha_hora")
    .range(pagina * tamano, pagina * tamano + tamano - 1)

  if (error) return errorJson(502, mensajeErrorSupabase(error))
  return Response.json({ ok: true, filas: data, total: count ?? 0, pagina, tamano })
}
