import { CircleCheck, CircleX, CloudUpload, Database, ListFilter } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { formatoEntero, formatoNumero } from "@/lib/etl/formato"
import { cn } from "@/lib/utils"
import { CabeceraTarjeta } from "./cabecera-tarjeta"
import { ValorAnimado } from "./valor-animado"

export interface ValoresContadores {
  extraidos: number
  validos: number
  rechazados: number
  coinciden: number
  seleccionados: number
}

/** Las cinco métricas de resumen en una tarjeta, con su porcentaje sobre el total extraído. */
/** `datos` cambia con cada extracción: entonces los números se animan desde 0. */
export function Contadores({ v, datos }: { v: ValoresContadores; datos: unknown }) {
  const items = [
    { etiqueta: "Descargados", valor: v.extraidos, icono: Database, tono: "neutro" },
    { etiqueta: "Válidos", valor: v.validos, icono: CircleCheck, tono: "bueno" },
    { etiqueta: "Descartados", valor: v.rechazados, icono: CircleX, tono: "malo" },
    { etiqueta: "Tras filtrar", valor: v.coinciden, icono: ListFilter, tono: "bueno" },
    { etiqueta: "Para guardar", valor: v.seleccionados, icono: CloudUpload, tono: "bueno" },
  ] as const

  return (
    <Card data-aparecer>
      <CabeceraTarjeta titulo="Resumen" />
      <CardContent>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {items.map((i) => (
            <div key={i.etiqueta} className="grid content-start gap-1 rounded-2xl bg-secondary/50 p-4">
              <dt className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <i.icono aria-hidden className="size-4 text-primary" />
                {i.etiqueta}
              </dt>
              <dd className="text-4xl font-light tracking-tight tabular-nums sm:text-5xl">
                <ValorAnimado valor={i.valor} datos={datos} formato={formatoEntero} />
              </dd>
              <dd
                className={cn(
                  "text-xs",
                  !v.extraidos || i.tono === "neutro" ? "text-muted-foreground" : i.tono === "bueno" ? "text-exito" : "text-destructive"
                )}
              >
                {v.extraidos ? `${formatoNumero(Math.round((i.valor / v.extraidos) * 1000) / 10)} % del total` : "—"}
              </dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  )
}
