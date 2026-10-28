import { Activity, CircleCheck, CircleX, CloudUpload, Globe, Play } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { CabeceraTarjeta } from "./cabecera-tarjeta"
import { EstadoVacio } from "./estado-vacio"
import type { EventoPipeline } from "./tipos-sesion"

const ICONOS = {
  inicio: { icono: Play, clase: "bg-secondary text-primary" },
  peticion: { icono: Globe, clase: "bg-secondary text-primary" },
  fase: { icono: CircleCheck, clase: "bg-exito-suave text-exito" },
  lote: { icono: CloudUpload, clase: "bg-secondary text-primary" },
  error: { icono: CircleX, clase: "bg-error-suave text-destructive" },
} as const

const hora = new Intl.DateTimeFormat("es-ES", { hour: "2-digit", minute: "2-digit", second: "2-digit" })

/** Registro en vivo de lo que hace el ETL; los más recientes arriba. */
export function ActividadPipeline({ eventos }: { eventos: EventoPipeline[] }) {
  return (
    <Card className="min-w-0 lg:absolute lg:inset-0">
      <CabeceraTarjeta titulo="Actividad" subtitulo="Lo último que ha pasado" />
      <CardContent className="min-h-0 flex-1 lg:overflow-y-auto">
        {eventos.length ? (
          <ol role="log" aria-live="polite" className="grid max-h-96 gap-1 overflow-y-auto pr-1 lg:max-h-none lg:overflow-visible">
            {eventos.map((e) => {
              const { icono: Icono, clase } = ICONOS[e.tipo]
              return (
                <li key={e.id} className="flex items-start gap-2.5 rounded-2xl bg-secondary/40 px-3 py-2">
                  <span aria-hidden className={cn("mt-0.5 grid size-6 shrink-0 place-items-center rounded-full", clase)}>
                    <Icono className="size-3.5" />
                  </span>
                  <div className="grid min-w-0 flex-1">
                    <p className="text-xs font-medium">{e.texto}</p>
                    {e.detalle && <p className="truncate text-[0.7rem] text-muted-foreground" title={e.detalle}>{e.detalle}</p>}
                  </div>
                  <time className="shrink-0 text-[0.7rem] text-muted-foreground tabular-nums" dateTime={new Date(e.hora).toISOString()}>
                    {hora.format(e.hora)}
                  </time>
                </li>
              )
            })}
          </ol>
        ) : (
          <EstadoVacio icono={Activity}>Aún no ha pasado nada. Pulsa «Extraer» para empezar.</EstadoVacio>
        )}
      </CardContent>
    </Card>
  )
}
