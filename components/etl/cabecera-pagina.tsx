import { Check, ChevronRight, CloudUpload, Download, ScanSearch } from "lucide-react"

import { cn } from "@/lib/utils"
import { ClimaCabecera, type TipoClima } from "./clima-cabecera"

export type EstadoDatos = "sin-datos" | "local" | "guardado"

const PASOS = [
  { texto: "Extrae", icono: Download },
  { texto: "Revisa", icono: ScanSearch },
  { texto: "Sube", icono: CloudUpload },
]

const ESTADOS: Record<EstadoDatos, { texto: string; clase: string }> = {
  "sin-datos": { texto: "Sin datos", clase: "bg-pendiente text-muted-foreground" },
  local: { texto: "Datos locales, sin guardar", clase: "bg-aviso-suave text-aviso" },
  guardado: { texto: "Guardado en Supabase", clase: "bg-exito-suave text-exito" },
}

/** Cabecera de la página, sin tarjeta: título, guía de 3 pasos y estado de los datos. */
export function CabeceraPagina({ paso, estado, clima }: { paso: 1 | 2 | 3; estado: EstadoDatos; clima: TipoClima | null }) {
  const e = ESTADOS[estado]
  return (
    // before: velo del color de fondo detrás del texto (por debajo de las partículas) para que el halo no le quite contraste
    <header
      id="inicio"
      className="relative isolate grid gap-5 py-4 before:absolute before:-inset-x-4 before:inset-y-0 before:-z-20 before:rounded-[3rem] before:bg-background/70 before:backdrop-blur-md before:[mask-image:linear-gradient(to_bottom,black_75%,transparent)]"
    >
      <ClimaCabecera tipo={clima} />
      <div className="grid gap-1.5">
        <p className="text-sm font-medium text-muted-foreground">Big Data · Práctica 1</p>
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Pipeline ETL</h1>
        <p className="text-base text-muted-foreground">Descarga datos del clima, revísalos y guárdalos en Supabase</p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <ol className="flex flex-wrap items-center gap-2" aria-label="Pasos">
          {PASOS.map((p, i) => {
            const n = i + 1
            const actual = n === paso
            const hecho = n < paso || (n === 3 && estado === "guardado")
            return (
              <li key={p.texto} className="flex items-center gap-2" aria-current={actual ? "step" : undefined}>
                <span
                  aria-hidden
                  className={cn(
                    "grid size-9 place-items-center rounded-full transition-colors duration-200",
                    actual ? "bg-primary text-primary-foreground" : "bg-secondary text-primary"
                  )}
                >
                  {hecho && !actual ? <Check className="size-4" /> : <p.icono className="size-4" />}
                </span>
                <span className={cn("text-sm", actual ? "font-semibold" : "text-muted-foreground")}>
                  <span className="tabular-nums">{n}</span> {p.texto}
                </span>
                {n < PASOS.length && <ChevronRight aria-hidden className="mx-1 size-4 text-muted-foreground" />}
              </li>
            )
          })}
        </ol>

        <p role="status" className={cn("inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium", e.clase)}>
          <span aria-hidden className="size-2 rounded-full bg-current" />
          {e.texto}
        </p>
      </div>

      {/* Una única onda suave que separa la cabecera del resto */}
      <svg aria-hidden viewBox="0 0 1200 48" preserveAspectRatio="none" className="-mb-4 h-10 w-full text-secondary sm:h-12">
        <path d="M0 48 V28 C 300 4, 900 52, 1200 22 V48 Z" fill="currentColor" opacity="0.6" />
      </svg>
    </header>
  )
}
