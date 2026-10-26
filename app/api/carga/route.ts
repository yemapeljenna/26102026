import {
  clienteOError,
  comprobarEntorno,
  errorJson,
  leerJsonLimitado,
  mensajeErrorSupabase,
} from "@/lib/supabase/api"
import { TABLA_MEDICIONES } from "@/lib/supabase/servidor"
import { validarPeticionCarga } from "@/lib/etl/validacion-servidor"

/**
 * Recibe un lote (≤ 500 filas), lo vuelve a validar y hace un upsert por
 * (ciudad, fecha_hora). PostgREST no indica qué filas eran nuevas y cuáles se
 * actualizaron, así que solo se informa de cuántas confirmó la base de datos.
 */
export async function POST(request: Request) {
  const bloqueo = comprobarEntorno()
  if (bloqueo) return bloqueo

  const lectura = await leerJsonLimitado(request)
  if (!lectura.ok) return lectura.respuesta

  const validacion = validarPeticionCarga(lectura.cuerpo)
  if (!validacion.ok) {
    return errorJson(422, "El lote no supera la validación del servidor.", validacion.errores)
  }

  const { cliente, respuesta } = clienteOError()
  if (!cliente) return respuesta

  const { data, error } = await cliente
    .from(TABLA_MEDICIONES)
    .upsert(validacion.valor, { onConflict: "ciudad,fecha_hora" })
    .select("id")

  if (error) return errorJson(502, mensajeErrorSupabase(error))
  return Response.json({ ok: true, recibidas: validacion.valor.length, confirmadas: data.length })
}
