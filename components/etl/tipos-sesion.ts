import type { Lote } from "@/lib/etl/carga"
import type { Ciudad } from "@/lib/etl/ciudades"
import type { FilaCarga } from "@/lib/etl/tipos"

export type EstadoPeticion = "pendiente" | "en_curso" | "completada" | "error"

export interface ExtraccionCiudad {
  ciudad: Ciudad
  url: string
  estado: EstadoPeticion
  /** JSON original tal como llegó. Se conserva durante la sesión. */
  json?: unknown
  estadoHttp?: number
  error?: string
  duracionMs?: number
  intentos: number
  descargadoEn?: string
  /** Solo en desarrollo: la respuesta salió de sessionStorage, sin llamar a la API. */
  desdeCache?: boolean
}

export interface Extraccion {
  inicio: string
  fin: string
  ciudades: ExtraccionCiudad[]
  terminada: boolean
  duracionMs?: number
}

export interface Verificacion {
  estado: "en_curso" | "completada" | "error"
  comprobadas: number
  encontradas: number
  faltantes: { ciudad: string; fecha_hora: string }[]
  error?: string
}

export interface Carga {
  /** Copia congelada del conjunto seleccionado y su orden en el momento de pulsar «Subir». */
  filas: FilaCarga[]
  huella: string
  lotes: Lote[]
  enCurso: boolean
  duracionMs?: number
  verificacion?: Verificacion
}

export type PestanaInspeccion =
  | "json"
  | "transformados"
  | "validos"
  | "rechazados"
  | "vista-previa"
  | "supabase"

/** Evento de la tarjeta «Actividad del pipeline». */
export interface EventoPipeline {
  id: number
  tipo: "inicio" | "peticion" | "fase" | "lote" | "error"
  texto: string
  detalle?: string
  /** Marca de tiempo (ms). */
  hora: number
}
