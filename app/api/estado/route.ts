import { comprobarEntorno, mensajeErrorSupabase } from "@/lib/supabase/api"
import { obtenerSupabase, TABLA_MEDICIONES } from "@/lib/supabase/servidor"
import type { EstadoIntegracion } from "@/lib/etl/api-tipos"

/** Informa si la carga es posible, sin revelar ningún valor de configuración. */
export async function GET() {
  const responder = (e: EstadoIntegracion) => Response.json(e)

  if (comprobarEntorno()) {
    return responder({
      habilitado: false,
      configurado: false,
      tablaDisponible: false,
      mensaje: "Carga deshabilitada en producción hasta añadir autenticación.",
    })
  }
  const config = obtenerSupabase()
  if (!config.ok) {
    return responder({ habilitado: true, configurado: false, tablaDisponible: false, mensaje: config.motivo })
  }
  // Sin `head`: una petición HEAD no trae cuerpo y PostgREST no puede explicar el error.
  const { error } = await config.cliente.from(TABLA_MEDICIONES).select("id").limit(1)
  if (error) {
    return responder({
      habilitado: true,
      configurado: true,
      tablaDisponible: false,
      mensaje: mensajeErrorSupabase(error),
    })
  }
  return responder({
    habilitado: true,
    configurado: true,
    tablaDisponible: true,
    mensaje: "Supabase configurado y tabla disponible.",
  })
}
