import { BancoTrabajo } from "@/components/etl/banco-trabajo"

export default function Page() {
  return (
    <main className="mx-auto w-full max-w-screen-2xl px-4 py-8 sm:px-6">
      <header className="mb-6 grid gap-2">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Big Data · Práctica 1
        </p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Pipeline ETL: Open-Meteo → Supabase
        </h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Extrae mediciones horarias históricas, observa cómo cambian los datos en cada fase, decide exactamente qué registros quieres
          guardar y cárgalos en una base de datos. Hasta que pulses «Subir», todo ocurre en tu navegador: son <strong>datos locales</strong>,
          no <strong>datos persistidos</strong>.
        </p>
      </header>
      <BancoTrabajo />
      <footer className="mt-10 text-xs text-muted-foreground">
        Datos meteorológicos: Open-Meteo.com (CC BY 4.0). Pulsa <kbd>d</kbd> para alternar el modo oscuro.
      </footer>
    </main>
  )
}
