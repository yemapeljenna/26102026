import { CircleCheck, CircleDashed, CircleX, LoaderCircle } from "lucide-react"
import { cn } from "@/lib/utils"

export type EstadoFase = "pendiente" | "en_curso" | "completada" | "error"

const CONFIG: Record<EstadoFase, { texto: string; icono: typeof CircleCheck; clase: string }> = {
  pendiente: { texto: "Pendiente", icono: CircleDashed, clase: "text-muted-foreground" },
  en_curso: { texto: "En curso", icono: LoaderCircle, clase: "text-sky-700 dark:text-sky-400" },
  completada: { texto: "Completada", icono: CircleCheck, clase: "text-emerald-700 dark:text-emerald-400" },
  error: { texto: "Con errores", icono: CircleX, clase: "text-destructive" },
}

/** Estado con icono y texto: no depende solo del color. */
export function IndicadorEstado({
  estado,
  texto,
  className,
}: {
  estado: EstadoFase
  texto?: string
  className?: string
}) {
  const c = CONFIG[estado]
  const Icono = c.icono
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium", c.clase, className)}>
      <Icono aria-hidden className={cn("size-4", estado === "en_curso" && "animate-spin")} />
      {texto ?? c.texto}
    </span>
  )
}
