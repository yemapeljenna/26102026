import { createClient, type SupabaseClient } from "@supabase/supabase-js"

// Solo debe importarse desde Route Handlers: usa la clave secreta, que omite RLS.
if (typeof window !== "undefined") {
  throw new Error("lib/supabase/servidor.ts no puede usarse en el navegador.")
}

export const TABLA_MEDICIONES = "mediciones_meteorologicas"

export type ConfiguracionSupabase =
  | { ok: true; cliente: SupabaseClient }
  | { ok: false; motivo: string }

let cliente: SupabaseClient | null = null

export function obtenerSupabase(): ConfiguracionSupabase {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const clave = process.env.SUPABASE_SECRET_KEY
  const faltan = [
    !url && "SUPABASE_URL (o NEXT_PUBLIC_SUPABASE_URL)",
    !clave && "SUPABASE_SECRET_KEY",
  ].filter(Boolean)
  if (faltan.length) {
    return { ok: false, motivo: `Faltan variables de entorno: ${faltan.join(", ")}.` }
  }
  if (clave!.startsWith("sb_publishable_")) {
    return {
      ok: false,
      motivo: "SUPABASE_SECRET_KEY contiene una clave publicable; se necesita la clave secreta.",
    }
  }
  cliente ??= createClient(url!, clave!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return { ok: true, cliente }
}
