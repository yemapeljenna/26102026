import { formatoEntero } from "@/lib/etl/formato"

export interface ValoresContadores {
  extraidos: number
  validos: number
  rechazados: number
  rechazadosCalidad: number
  duplicados: number
  coinciden: number
  seleccionados: number
}

export function Contadores({ v }: { v: ValoresContadores }) {
  const items = [
    { etiqueta: "Total extraído", valor: v.extraidos, ayuda: "Registros horarios tras transformar" },
    { etiqueta: "Válidos", valor: v.validos, ayuda: "Superan la limpieza" },
    {
      etiqueta: "Rechazados",
      valor: v.rechazados,
      ayuda: `${formatoEntero(v.rechazadosCalidad)} por calidad · ${formatoEntero(v.duplicados)} duplicados`,
    },
    { etiqueta: "Coinciden con los filtros", valor: v.coinciden, ayuda: "Válidos que cumplen los filtros" },
    { etiqueta: "Seleccionados para cargar", valor: v.seleccionados, ayuda: "Seleccionados y dentro de los filtros", destacado: true },
  ]
  return (
    <section aria-label="Contadores del conjunto de datos">
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
        {items.map((i) => (
          <div
            key={i.etiqueta}
            className={
              i.destacado
                ? "rounded-xl border-2 border-primary/50 bg-primary/5 p-3"
                : "rounded-xl border bg-card p-3"
            }
          >
            <dt className="text-xs font-medium text-muted-foreground">{i.etiqueta}</dt>
            <dd className="text-2xl font-semibold tabular-nums">{formatoEntero(i.valor)}</dd>
            <dd className="text-[0.7rem] text-muted-foreground">{i.ayuda}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
