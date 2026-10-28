import { BancoTrabajo } from "@/components/etl/banco-trabajo"
import { FondoInteractivo } from "@/components/fondo-interactivo"
import { Navbar } from "@/components/navbar"

export default function Page() {
  return (
    <>
      <FondoInteractivo />
      <Navbar />
      <main className="mx-auto w-full max-w-screen-2xl px-4 pt-6 pb-8 sm:px-6">
        <BancoTrabajo />
        <footer className="mt-10 w-fit rounded-2xl bg-background/70 px-3 py-2 text-xs text-muted-foreground backdrop-blur-sm">
          Datos meteorológicos: Open-Meteo.com (CC BY 4.0). Pulsa <kbd>d</kbd> para alternar el tema claro/oscuro.
        </footer>
      </main>
    </>
  )
}
