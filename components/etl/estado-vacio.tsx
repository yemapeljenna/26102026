import type { LucideIcon } from "lucide-react"

/** Estado vacío centrado: icono grande y suave del primario con el texto debajo. */
export function EstadoVacio({ icono: Icono, children }: { icono: LucideIcon; children: React.ReactNode }) {
  return (
    <div className="grid justify-items-center gap-3 py-8 text-center">
      <span aria-hidden className="grid size-14 place-items-center rounded-full bg-secondary text-primary">
        <Icono className="size-7" strokeWidth={1.5} />
      </span>
      <p className="max-w-64 text-sm text-muted-foreground">{children}</p>
    </div>
  )
}
