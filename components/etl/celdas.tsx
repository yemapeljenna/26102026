import { describirValorBruto, formatoNumero } from "@/lib/etl/formato"
import { formatearFechaHora } from "@/lib/etl/fechas"
import type { Medicion } from "@/lib/etl/tipos"
import { cn } from "@/lib/utils"
import type { Columna } from "./tabla-paginada"

export function ValorBruto({ valor }: { valor: unknown }) {
  const d = describirValorBruto(valor)
  return (
    <span className={cn("font-mono text-xs", d.especial && "rounded bg-amber-500/15 px-1 text-amber-900 dark:text-amber-200")}>
      {d.texto}
    </span>
  )
}

export function FechaUtc({ iso }: { iso: string }) {
  return <time dateTime={iso} className="tabular-nums">{formatearFechaHora(iso)}</time>
}

/** Columnas comunes de una medición válida. */
export function columnasMedicion(): Columna<Medicion>[] {
  return [
    { id: "ciudad", encabezado: "Ciudad", celda: (m) => m.ciudad },
    { id: "fecha_hora", encabezado: "Fecha y hora", unidad: "UTC", celda: (m) => <FechaUtc iso={m.fecha_hora} /> },
    { id: "temperatura_c", encabezado: "Temperatura", unidad: "°C", numerica: true, celda: (m) => formatoNumero(m.temperatura_c) },
    { id: "humedad_pct", encabezado: "Humedad relativa", unidad: "%", numerica: true, celda: (m) => formatoNumero(m.humedad_pct) },
    { id: "precipitacion_mm", encabezado: "Precipitación", unidad: "mm", numerica: true, celda: (m) => formatoNumero(m.precipitacion_mm) },
  ]
}
