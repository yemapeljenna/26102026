import { ChevronRight } from "lucide-react"

import { cn } from "@/lib/utils"

/** Desplegable plegado para lo técnico (huellas, lotes, URL, tiempos): visible solo si se busca. */
export function DetallesTecnicos({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <details className={cn("group text-xs text-muted-foreground", className)}>
      <summary className="flex w-fit cursor-pointer list-none items-center gap-1 rounded font-medium outline-none select-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
        <ChevronRight aria-hidden className="size-3.5 transition-transform duration-150 group-open:rotate-90" />
        Detalles técnicos
      </summary>
      <div className="mt-2 grid gap-2">{children}</div>
    </details>
  )
}
