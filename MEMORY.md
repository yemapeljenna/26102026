# Rediseño de la interfaz — Pipeline ETL Open-Meteo → Supabase

Proyecto: Next.js 16 + Tailwind 4 + shadcn. Leaflet + react-leaflet para el mapa.

**Restricción principal:** solo la parte visual. NO tocar la lógica del ETL, las rutas de `/api`, ni `lib/etl` ni `lib/supabase`.

## Estado actual

### Layout
- Grid de 4 columnas en escritorio (`lg:grid-cols-4`) en [components/etl/banco-trabajo.tsx](components/etl/banco-trabajo.tsx):
  - **Pipeline (3 de 4, `lg:col-span-3`)** a la izquierda: configuración, pipeline, contadores, selección, inspección y carga, en ese orden.
  - **Mapa (1 de 4)** arriba a la derecha (`lg:order-last`), sticky al hacer scroll (`lg:sticky lg:top-6`).
- Móvil y tablet: 1 columna, primero el mapa y debajo el pipeline.
- Los repartos internos en varias columnas usan `xl:` (no `lg:`), porque el pipeline ocupa 3/4 del ancho.
- Ancho máximo de la página: `max-w-screen-2xl`.

### Mapa
- [components/etl/panel-mapa.tsx](components/etl/panel-mapa.tsx): tarjeta del mapa. Carga `MapaEspana` con `next/dynamic` y `ssr: false`, altura fija de 340px y resumen compacto de la ciudad activa debajo (sin coordenadas).
- [components/etl/mapa-espana.tsx](components/etl/mapa-espana.tsx):
  - Teselas MapTiler `dataviz-dark` con `tileSize={512}` y `zoomOffset={-1}`.
  - `invalidateSize()` al montar y con un `ResizeObserver`, más `fitBounds` de las 5 ciudades: evita la zona gris.
  - Cada ciudad es una zona `Circle` de 18 km en `--primary`, con el nombre como `Tooltip permanent`.
  - Estado visual: la ciudad activa tiene más opacidad y borde más grueso; las que no están en la configuración salen apagadas.
  - Popup con temperatura media, humedad media y precipitación total, o «Extrae datos para ver el resumen».
  - `attributionControl={false}`: sin el prefijo «Leaflet» con la bandera.
- Ciudad activa compartida entre el mapa y las pestañas de ciudad del JSON original (estado en `BancoTrabajo`).
- Los resúmenes se calculan con los registros **válidos** (tras la limpieza).
- Estilos del mapa al final de [app/globals.css](app/globals.css), solo con tokens del tema.

### Variables de entorno
- `NEXT_PUBLIC_MAPTILER_KEY` en `.env.local` (nunca en el código). Documentada en el README y en `.env.example`.
- Si falta, la tarjeta muestra «Falta configurar NEXT_PUBLIC_MAPTILER_KEY».
- Hay que reiniciar `npm run dev` tras cambiarla, porque se incrusta al compilar.

## Pendiente
- **Atribución:** la de «© MapTiler © OpenStreetMap contributors» se quitó. La exigen el plan gratuito de MapTiler y la licencia de OSM. Se puede recuperar sin la bandera con `<AttributionControl prefix={false} />`.

## Criterios de estilo y código
- Tema oscuro y acento rosa/magenta del proyecto; sin colores nuevos.
- Legible y ordenado: sin animaciones llamativas, degradados ni glassmorphism.
- Tarjetas con el mismo estilo que las existentes; JSON en monoespaciada con scroll interno.
- Nombres y comentarios en español, breves. Sin código muerto.
- No pasar Prettier a archivos enteros (reformatea todo con `printWidth: 80`); seguir el formato existente.
- Comprobar `npm run build` antes de subir.
