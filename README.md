# Pipeline ETL: Open-Meteo → Supabase

Práctica 1 de Big Data. Una aplicación web para ejecutar y **ver** un pipeline ETL completo:
extraer mediciones horarias de la API histórica de Open-Meteo, transformarlas, limpiarlas,
filtrarlas, elegir qué filas subir y cargarlas en Supabase.

Stack: Next.js 16 (App Router), TypeScript, Tailwind CSS 4, shadcn/ui, `@supabase/supabase-js`, Vitest.

## Instalación

```bash
npm install
cp .env.example .env.local   # y rellena los valores
```

### Variables de entorno

| Variable | Dónde se usa | Descripción |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` (o `SUPABASE_URL`) | servidor | URL del proyecto Supabase. |
| `SUPABASE_SECRET_KEY` | **solo servidor** | Clave secreta (`sb_secret_…` o la antigua `service_role`). Nunca con prefijo `NEXT_PUBLIC_`. |
| `NEXT_PUBLIC_MAPTILER_KEY` | navegador | Clave de [MapTiler](https://cloud.maptiler.com/account/keys/) para las teselas del mapa (estilo `dataviz`). Es pública: restríngela por dominio en MapTiler. Sin ella, el mapa muestra un aviso. |
| `ETL_PERMITIR_EN_PRODUCCION` | servidor | Opcional. Ver «Seguridad». |

### Base de datos

Ejecuta la migración [`supabase/migrations/20261026120000_crear_mediciones_meteorologicas.sql`](supabase/migrations/20261026120000_crear_mediciones_meteorologicas.sql)
en **Supabase → SQL Editor → Run** (o `supabase db push` con la CLI enlazada). Crea la tabla
`mediciones_meteorologicas` con la restricción única `(ciudad, fecha_hora)`, comprobaciones de
humedad (0–100) y precipitación (≥ 0), y RLS activado **sin políticas**.

## Ejecución

```bash
npm run dev               # http://localhost:3000
npm test                  # pruebas unitarias con fixtures controlados
npm run test:integracion  # Open-Meteo real + Supabase real (requiere npm run dev y la migración)
npm run typecheck && npm run build
```

## El pipeline

1. **Extracción.** Una petición por ciudad a `https://archive-api.open-meteo.com/v1/archive` con
   `hourly=temperature_2m,relative_humidity_2m,precipitation`, `timezone=UTC`, °C y mm. Como máximo
   31 días. El JSON original se conserva durante la sesión y se puede descargar. Si una ciudad falla,
   se reintenta solo esa ciudad, y su resultado sustituye al anterior (no se duplica).
2. **Transformación.** La API devuelve arrays paralelos (`time[i]`, `temperature_2m[i]`, …). Se convierten
   en un registro por ciudad y hora: `ciudad, fecha_hora, temperatura_c, humedad_pct, precipitacion_mm`.
   `time` llega sin zona (`2026-09-01T00:00`) y se interpreta explícitamente como UTC. Se comprueba que
   los arrays tienen la misma longitud. Los valores **no se corrigen**: `null` sigue siendo `null`.
3. **Limpieza.** Se rechaza, con su motivo, cualquier registro sin ciudad, sin fecha válida o sin alguna
   de las tres mediciones. También se rechazan los valores `null`, las cadenas vacías, el texto y los
   números no finitos, la humedad fuera de 0–100 y la precipitación negativa. No hay umbrales de
   temperatura: un valor extremo es un dato. Después se eliminan los duplicados por `(ciudad, fecha_hora)`
   y **se conserva la primera aparición** en el orden de extracción. Los duplicados se cuentan aparte de
   los rechazos por calidad.
4. **Filtrado y selección.** Orden fijo: *válidos → filtros → ordenación → selección → carga*. La
   paginación solo afecta a la vista. Solo se suben las filas **seleccionadas que cumplen los filtros
   actuales**. Cambiar los filtros nunca selecciona filas nuevas, y las seleccionadas que quedan fuera
   se cuentan aparte.
5. **Carga.** Al pulsar «Subir» se congela una copia del conjunto y de su orden. El navegador la envía
   en lotes de ≤ 500 filas a `POST /api/carga`. El servidor vuelve a validar cada fila y el tamaño de la
   petición, y hace un `upsert` con `onConflict: ciudad,fecha_hora`, de modo que repetir una carga
   actualiza las filas en lugar de duplicarlas. Cada lote tiene su propio estado; los fallidos se pueden
   reintentar sin reenviar los correctos. Después, `POST /api/verificar` comprueba, lote a lote, que cada
   clave enviada existe en destino. Supabase no indica qué filas se insertaron y cuáles se actualizaron,
   así que la aplicación no inventa esos recuentos.

La vista previa y la carga muestran una **huella** (número de filas + hash en orden) para comprobar
que lo enviado coincide con lo previsto. Una tabla no conserva el orden de inserción: para leer los
datos ordenados, usa `ORDER BY` (la pestaña «Datos en Supabase» lo hace).

## Seguridad

- Toda lectura y escritura en Supabase ocurre en Route Handlers (`app/api/*`) con la clave secreta.
  El navegador nunca recibe la clave y no habla con Supabase directamente.
- RLS está activado y no hay políticas: los roles `anon` y `authenticated` no pueden leer ni escribir.
- **La aplicación no tiene autenticación.** Por eso los endpoints solo funcionan en desarrollo
  (`npm run dev`). En producción responden 403, salvo que se defina `ETL_PERMITIR_EN_PRODUCCION=true`.
  Antes de publicarla hay que añadir autenticación y proteger `app/api/*`.
- `.env.local` está en `.gitignore`; `.env.example` no contiene valores reales.

## Estructura

```
lib/etl/          lógica pura del pipeline (extracción, transformación, limpieza, filtros, lotes, validación)
lib/supabase/     cliente de servidor y utilidades de los endpoints
app/api/          carga, verificar, mediciones (lectura), estado
components/etl/   interfaz: configuración, pipeline, contadores, selección, inspección, carga
tests/            pruebas unitarias + fixtures (nulos, duplicados, longitudes incoherentes)
tests/integracion pruebas contra Open-Meteo y Supabase reales
supabase/migrations/  SQL de la tabla destino
```
