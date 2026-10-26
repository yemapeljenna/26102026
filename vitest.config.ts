import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./", import.meta.url)) },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    // Las pruebas de integración usan red y servicios reales: se lanzan aparte.
    exclude: ["tests/integracion/**", "node_modules/**"],
  },
})
