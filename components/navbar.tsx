"use client"

import * as React from "react"
import Image from "next/image"
import { ChartNoAxesCombined, CloudUpload, Download, ListFilter, Map as Mapa, Menu, Workflow, X } from "lucide-react"

import { BotonTema } from "@/components/boton-tema"
import { SelectorPaleta } from "@/components/selector-paleta"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const ENLACES = [
  { id: "configuracion", texto: "Extraer", Icono: Download },
  { id: "pipeline", texto: "Proceso", Icono: Workflow },
  { id: "mapa", texto: "Mapa", Icono: Mapa },
  { id: "analisis", texto: "Análisis", Icono: ChartNoAxesCombined },
  { id: "seleccion", texto: "Filtrar", Icono: ListFilter },
  { id: "carga", texto: "Subir", Icono: CloudUpload },
]

// Secciones vigiladas al hacer scroll, en orden, y el enlace que activan (la inspección cuenta como «Filtrar»)
const SECCIONES: [string, string][] = [
  ["configuracion", "configuracion"],
  ["pipeline", "pipeline"],
  ["mapa", "mapa"],
  ["analisis", "analisis"],
  ["seleccion", "seleccion"],
  ["inspeccion", "seleccion"],
  ["carga", "carga"],
]

// Línea (px desde arriba) que marca qué sección está activa; algo más que el alto de la navbar
const UMBRAL_ACTIVA = 140

/** Enlace activo: el de la última sección cuyo borde superior ya ha pasado la línea (ninguno arriba del todo). */
function seccionActiva(): string | null {
  let activa: string | null = null
  for (const [id, enlace] of SECCIONES) {
    const top = document.getElementById(id)?.getBoundingClientRect().top
    if (top !== undefined && top <= UMBRAL_ACTIVA) activa = enlace
  }
  return activa
}

/** «Subir» lleva a la carga y pone el foco en su botón (o en la tarjeta si el botón está desactivado). */
function enfocarCarga() {
  requestAnimationFrame(() => {
    const boton = document.getElementById("boton-guardar") as HTMLButtonElement | null
    const destino = boton && !boton.disabled ? boton : document.getElementById("carga")
    destino?.focus({ preventScroll: true })
  })
}

const claseEnlace =
  "flex items-center gap-2 rounded-full px-4 py-2 text-base font-medium text-muted-foreground transition-colors duration-150 outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 aria-[current]:bg-primary aria-[current]:text-primary-foreground lg:px-3 xl:px-4"

/** Navbar flotante en píldora: fija al hacer scroll y algo más compacta al bajar. */
export function Navbar() {
  const [compacto, setCompacto] = React.useState(false)
  const [abierto, setAbierto] = React.useState(false)
  const [activa, setActiva] = React.useState<string | null>(null)

  React.useEffect(() => {
    const alDesplazar = () => {
      setCompacto(window.scrollY > 24)
      setActiva(seccionActiva())
    }
    alDesplazar()
    window.addEventListener("scroll", alDesplazar, { passive: true })
    window.addEventListener("resize", alDesplazar)
    return () => {
      window.removeEventListener("scroll", alDesplazar)
      window.removeEventListener("resize", alDesplazar)
    }
  }, [])

  // Escape cierra el menú móvil
  React.useEffect(() => {
    if (!abierto) return
    const alPulsar = (e: KeyboardEvent) => e.key === "Escape" && setAbierto(false)
    window.addEventListener("keydown", alPulsar)
    return () => window.removeEventListener("keydown", alPulsar)
  }, [abierto])

  const enlaces = ENLACES.map((e) => (
    <li key={e.id}>
      <a
        href={`#${e.id}`}
        aria-current={activa === e.id ? "location" : undefined}
        onClick={() => {
          setAbierto(false)
          if (e.id === "carga") enfocarCarga()
        }}
        className={claseEnlace}
      >
        <e.Icono className="size-4 shrink-0" aria-hidden />
        {e.texto}
      </a>
    </li>
  ))

  return (
    <div className="pointer-events-none sticky top-4 z-50 mt-4 flex justify-center px-4">
      <nav
        aria-label="Principal"
        className={cn(
          "pointer-events-auto relative flex items-center gap-3 rounded-full border transition-all duration-200 lg:gap-4 xl:gap-6",
          // Arriba, casi sólida; al bajar, cristal
          compacto
            ? "h-13 border-white/30 bg-card/40 pr-2 pl-4 shadow-tarjeta-hover backdrop-blur-xl backdrop-saturate-150 dark:border-white/10"
            : "h-16 border-border bg-card/95 pr-3 pl-6 shadow-tarjeta"
        )}
      >
        <a href="#inicio" aria-label="DataSky, ir arriba" className="flex shrink-0 items-center gap-2.5 rounded-full text-lg font-semibold tracking-tight">
          {/* Icono según el tema, alternado por CSS para evitar parpadeos */}
          <Image src="/img/icono.webp" alt="" width={71} height={40} fetchPriority="high" className={cn("w-auto transition-all duration-200 dark:hidden", compacto ? "h-8" : "h-10")} />
          <Image src="/img/icono-oscuro.webp" alt="" width={71} height={40} fetchPriority="high" className={cn("hidden w-auto transition-all duration-200 dark:block", compacto ? "h-8" : "h-10")} />
          DataSky
        </a>

        <ul className="hidden items-center gap-0.5 lg:flex xl:gap-1">{enlaces}</ul>

        <div className="hidden items-center gap-1 lg:flex">
          <BotonTema />
          <SelectorPaleta />
        </div>

        <Button
          variant="ghost"
          size="icon-lg"
          className="rounded-full lg:hidden"
          aria-label={abierto ? "Cerrar menú" : "Abrir menú"}
          aria-expanded={abierto}
          aria-controls="menu-movil"
          onClick={() => setAbierto((a) => !a)}
        >
          {abierto ? <X className="size-5" /> : <Menu className="size-5" />}
        </Button>

        {/* Menú móvil: se despliega bajo la píldora */}
        <div
          id="menu-movil"
          hidden={!abierto}
          className="absolute top-full right-0 mt-2 max-h-[calc(100dvh-6rem)] w-60 overflow-y-auto rounded-2xl border bg-card/95 p-2 shadow-tarjeta-hover backdrop-blur-xl lg:hidden"
        >
          <ul className="grid gap-1">{enlaces}</ul>
          <div className="mt-2 flex items-center justify-end gap-1 border-t pt-2">
            <BotonTema />
            <SelectorPaleta />
          </div>
        </div>
      </nav>
    </div>
  )
}
