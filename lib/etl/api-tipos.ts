/** Contratos JSON entre el navegador y los Route Handlers de app/api. */

export interface EstadoIntegracion {
  habilitado: boolean
  configurado: boolean
  tablaDisponible: boolean
  mensaje: string
}

export interface FilaPersistida {
  id: number
  ciudad: string
  fecha_hora: string
  temperatura_c: number
  humedad_pct: number
  precipitacion_mm: number
  importado_en: string
}

export type RespuestaApiError = { ok: false; error: string; detalles?: string[] }

export type RespuestaCarga = { ok: true; recibidas: number; confirmadas: number } | RespuestaApiError

export type RespuestaVerificacion =
  | {
      ok: true
      comprobadas: number
      encontradas: number
      faltantes: { ciudad: string; fecha_hora: string }[]
    }
  | RespuestaApiError

export type RespuestaMediciones =
  | { ok: true; filas: FilaPersistida[]; total: number; pagina: number; tamano: number }
  | RespuestaApiError
