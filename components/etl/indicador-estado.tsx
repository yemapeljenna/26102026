import { CircleCheck, CircleDashed, CircleX, LoaderCircle } from "lucide-react"
import { cn } from "@/lib/utils"

export type EstadoFase = "pendiente" | "en_curso" | "completada" | "error"

// Chip de color por estado; cada par texto/fondo cumple 4,5:1.
const CONFIG: Record<EstadoFase, { texto: string; icono: typeof CircleCheck; clase: string }> = {
  pendiente: { texto: "Pendiente", icono: CircleDashed, clase: "bg-pendiente text-muted-foreground" },
  en_curso: { texto: "En curso", icono: LoaderCircle, clase: "bg-secondary text-primary" },
  completada: { texto: "Completada", icono: CircleCheck, clase: "bg-exito-suave text-exito" },
  error: { texto: "Con errores", icono: CircleX, clase: "bg-error-suave text-destructive" },
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
    <span className={cn("inline-flex w-fit items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium", c.clase, className)}>
      <Icono aria-hidden className={cn("size-4", estado === "en_curso" && "motion-safe:animate-spin")} />
      {texto ?? c.texto}
    </span>
  )
}
