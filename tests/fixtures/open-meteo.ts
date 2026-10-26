/**
 * Respuestas de Open-Meteo construidas a mano para pruebas.
 * NO se usan en la aplicación: las extracciones reales siempre vienen de la API.
 */

function horas(dia: string, n = 24): string[] {
  return Array.from({ length: n }, (_, h) => `${dia}T${String(h).padStart(2, "0")}:00`)
}

function base(time: unknown[], t: unknown[], hr: unknown[], p: unknown[]) {
  return {
    latitude: 41.44,
    longitude: 2.2,
    utc_offset_seconds: 0,
    timezone: "GMT",
    hourly_units: { time: "iso8601", temperature_2m: "°C", relative_humidity_2m: "%", precipitation: "mm" },
    hourly: { time, temperature_2m: t, relative_humidity_2m: hr, precipitation: p },
  }
}

/** Un día completo y correcto. */
export const respuestaUnDia = base(
  horas("2026-09-01"),
  Array.from({ length: 24 }, (_, i) => 20 + i / 2),
  Array.from({ length: 24 }, (_, i) => 50 + i),
  Array.from({ length: 24 }, (_, i) => (i === 5 ? 1.2 : 0))
)

/** Seis horas con los problemas típicos de calidad. */
export const respuestaConProblemas = base(
  horas("2026-09-02", 6),
  [18.5, null, 17.9, "", -45.3, 19],
  [70, 72, 101, 65, 60, "80"],
  [0, 0.4, 0, -0.1, null, 0]
)

/** «time» tiene 4 elementos pero la humedad solo 3. */
export const respuestaLongitudesIncoherentes = base(
  horas("2026-09-03", 4),
  [10, 11, 12, 13],
  [50, 51, 52],
  [0, 0, 0, 0]
)

/** La hora 01:00 aparece dos veces con valores distintos. */
export const respuestaConDuplicado = base(
  ["2026-09-04T00:00", "2026-09-04T01:00", "2026-09-04T01:00", "2026-09-04T02:00"],
  [15, 16, 99, 17],
  [40, 41, 42, 43],
  [0, 0, 0, 0]
)

/** Fecha imposible y respuesta sin zona UTC. */
export const respuestaFechaInvalida = base(["2026-02-30T00:00", "no-es-fecha"], [1, 2], [3, 4], [0, 0])
export const respuestaNoUtc = { ...respuestaUnDia, utc_offset_seconds: 7200 }
