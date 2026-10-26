import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

// Pruebas contra servicios reales: Open-Meteo y la app local (npm run dev) conectada a Supabase.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./", import.meta.url)) },
  },
  test: {
    include: ["tests/integracion/**/*.test.ts"],
    testTimeout: 60_000,
    fileParallelism: false,
  },
})
