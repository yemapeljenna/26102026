import {
  clienteOError,
  comprobarEntorno,
  errorJson,
  leerJsonLimitado,
  mensajeErrorSupabase,
} from "@/lib/supabase/api"
import { TABLA_MEDICIONES } from "@/lib/supabase/servidor"
import { normalizarTimestamp } from "@/lib/etl/fechas"
import { claveMedicion } from "@/lib/etl/tipos"
import { validarPeticionVerificacion } from "@/lib/etl/validacion-servidor"

const PAGINA = 1000

/** Comprueba qué claves (ciudad, fecha_hora) de un lote existen ya en la tabla destino. */
export async function POST(request: Request) {
  const bloqueo = comprobarEntorno()
  if (bloqueo) return bloqueo

  const lectura = await leerJsonLimitado(request)
  if (!lectura.ok) return lectura.respuesta
  const validacion = validarPeticionVerificacion(lectura.cuerpo)
  if (!validacion.ok) return errorJson(422, "Petición de verificación no válida.", validacion.errores)

  const { cliente, respuesta } = clienteOError()
  if (!cliente) return respuesta

  // Una consulta por ciudad acotada al rango de fechas del lote (evita URLs enormes con IN).
  const porCiudad = new Map<string, string[]>()
  for (const c of validacion.valor) {
    porCiudad.set(c.ciudad, [...(porCiudad.get(c.ciudad) ?? []), c.fecha_hora])
  }

  const existentes = new Set<string>()
  for (const [ciudad, fechas] of porCiudad) {
    const ordenadas = [...fechas].sort()
    for (let desde = 0; ; desde += PAGINA) {
      const { data, error } = await cliente
        .from(TABLA_MEDICIONES)
        .select("ciudad, fecha_hora")
        .eq("ciudad", ciudad)
        .gte("fecha_hora", ordenadas[0])
        .lte("fecha_hora", ordenadas[ordenadas.length - 1])
        .order("fecha_hora")
        .range(desde, desde + PAGINA - 1)
      if (error) return errorJson(502, mensajeErrorSupabase(error))
      for (const fila of data) {
        const fecha = normalizarTimestamp(fila.fecha_hora)
        if (fecha) existentes.add(claveMedicion(fila.ciudad, fecha))
      }
      if (data.length < PAGINA) break
    }
  }

  const faltantes = validacion.valor.filter(
    (c) => !existentes.has(claveMedicion(c.ciudad, c.fecha_hora))
  )
  return Response.json({
    ok: true,
    comprobadas: validacion.valor.length,
    encontradas: validacion.valor.length - faltantes.length,
    faltantes,
  })
}
