import { interpretarFechaHoraUtc } from "./fechas"
import type { Medicion } from "./tipos"

export interface Filtros {
  /** Ciudades incluidas. */
  ciudades: string[]
  /** "AAAA-MM-DDTHH:MM" interpretado como UTC; vacío = sin límite. */
  desde: string
  hasta: string
  temperaturaMin: string
  temperaturaMax: string
  humedadMin: string
  humedadMax: string
  precipitacionMin: string
  precipitacionMax: string
  soloLluvia: boolean
}

export type CampoOrden =
  | "ciudad"
  | "fecha_hora"
  | "temperatura_c"
  | "humedad_pct"
  | "precipitacion_mm"

export interface Orden {
  campo: CampoOrden
  direccion: "asc" | "desc"
}

export const ORDEN_INICIAL: Orden = { campo: "fecha_hora", direccion: "asc" }

export function filtrosIniciales(ciudades: string[]): Filtros {
  return {
    ciudades: [...ciudades],
    desde: "",
    hasta: "",
    temperaturaMin: "",
    temperaturaMax: "",
    humedadMin: "",
    humedadMax: "",
    precipitacionMin: "",
    precipitacionMax: "",
    soloLluvia: false,
  }
}

interface Limite {
  valor: number | null
  error?: string
}

function leerNumero(texto: string, etiqueta: string): Limite {
  const t = texto.trim().replace(",", ".")
  if (t === "") return { valor: null }
  const n = Number(t)
  if (!Number.isFinite(n)) return { valor: null, error: `${etiqueta}: «${texto}» no es un número.` }
  return { valor: n }
}

function leerFecha(texto: string, etiqueta: string): { valor: string | null; error?: string } {
  if (texto.trim() === "") return { valor: null }
  const iso = interpretarFechaHoraUtc(texto)
  if (!iso) return { valor: null, error: `${etiqueta}: fecha y hora no válida.` }
  return { valor: iso }
}

export interface FiltrosInterpretados {
  ciudades: Set<string>
  desde: string | null
  hasta: string | null
  rangos: { campo: "temperatura_c" | "humedad_pct" | "precipitacion_mm"; min: number | null; max: number | null }[]
  soloLluvia: boolean
  errores: string[]
}

/** Interpreta los textos del formulario. Un límite no válido se ignora y se informa. */
export function interpretarFiltros(f: Filtros): FiltrosInterpretados {
  const errores: string[] = []
  const desde = leerFecha(f.desde, "Desde")
  const hasta = leerFecha(f.hasta, "Hasta")
  for (const r of [desde, hasta]) if (r.error) errores.push(r.error)
  if (desde.valor && hasta.valor && desde.valor > hasta.valor) {
    errores.push("El intervalo de fechas está invertido: no coincidirá ningún registro.")
  }

  const pares = [
    ["temperatura_c", f.temperaturaMin, f.temperaturaMax, "Temperatura"],
    ["humedad_pct", f.humedadMin, f.humedadMax, "Humedad"],
    ["precipitacion_mm", f.precipitacionMin, f.precipitacionMax, "Precipitación"],
  ] as const
  const rangos = pares.map(([campo, min, max, etiqueta]) => {
    const a = leerNumero(min, `${etiqueta} mínima`)
    const b = leerNumero(max, `${etiqueta} máxima`)
    if (a.error) errores.push(a.error)
    if (b.error) errores.push(b.error)
    if (a.valor !== null && b.valor !== null && a.valor > b.valor) {
      errores.push(`${etiqueta}: el mínimo es mayor que el máximo; no coincidirá ningún registro.`)
    }
    return { campo, min: a.valor, max: b.valor }
  })

  return {
    ciudades: new Set(f.ciudades),
    desde: desde.valor,
    hasta: hasta.valor,
    rangos,
    soloLluvia: f.soloLluvia,
    errores,
  }
}

export function cumpleFiltros(m: Medicion, f: FiltrosInterpretados): boolean {
  if (!f.ciudades.has(m.ciudad)) return false
  // Las fechas están todas en el mismo formato ISO UTC, así que se comparan como texto.
  if (f.desde && m.fecha_hora < f.desde) return false
  if (f.hasta && m.fecha_hora > f.hasta) return false
  for (const r of f.rangos) {
    const v = m[r.campo]
    if (r.min !== null && v < r.min) return false
    if (r.max !== null && v > r.max) return false
  }
  if (f.soloLluvia && !(m.precipitacion_mm > 0)) return false
  return true
}

function comparar(a: Medicion, b: Medicion, campo: CampoOrden): number {
  const x = a[campo]
  const y = b[campo]
  if (typeof x === "number" && typeof y === "number") return x - y
  return String(x).localeCompare(String(y), "es")
}

/** Ordena sin mutar. Desempata por ciudad y fecha para que el orden sea determinista. */
export function ordenar(registros: Medicion[], orden: Orden): Medicion[] {
  const signo = orden.direccion === "asc" ? 1 : -1
  return [...registros].sort(
    (a, b) =>
      signo * comparar(a, b, orden.campo) ||
      comparar(a, b, "ciudad") ||
      comparar(a, b, "fecha_hora")
  )
}

export interface ResultadoSeleccion {
  /** Válidos que cumplen los filtros, ya ordenados (antes de paginar). */
  coincidentes: Medicion[]
  /** Subconjunto de `coincidentes` seleccionado, en el mismo orden: lo que se subirá. */
  paraCargar: Medicion[]
  /** Claves seleccionadas que ya no cumplen los filtros (no se subirán). */
  seleccionadosFueraDeFiltro: number
  errores: string[]
  duracionMs: number
}

/** datos válidos → filtros → ordenación → selección. La paginación es posterior y solo visual. */
export function calcularSeleccion(
  validos: Medicion[],
  filtros: Filtros,
  orden: Orden,
  seleccion: ReadonlySet<string>
): ResultadoSeleccion {
  const t0 = performance.now()
  const f = interpretarFiltros(filtros)
  const filtrados: Medicion[] = []
  let seleccionadosFueraDeFiltro = 0
  for (const m of validos) {
    if (cumpleFiltros(m, f)) filtrados.push(m)
    else if (seleccion.has(m.clave)) seleccionadosFueraDeFiltro++
  }
  const coincidentes = ordenar(filtrados, orden)
  const paraCargar = coincidentes.filter((m) => seleccion.has(m.clave))
  return {
    coincidentes,
    paraCargar,
    seleccionadosFueraDeFiltro,
    errores: f.errores,
    duracionMs: performance.now() - t0,
  }
}

export function paginar<T>(filas: T[], pagina: number, tamano: number): T[] {
  return filas.slice(pagina * tamano, (pagina + 1) * tamano)
}
