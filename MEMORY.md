# Rediseño de la interfaz — Pipeline ETL Open-Meteo → Supabase

Proyecto: Next.js 16 + Tailwind 4 + shadcn (base-ui). Leaflet + react-leaflet para el mapa, recharts (charts de shadcn) para los gráficos.

**Restricción principal:** solo la parte visual. NO tocar la lógica del ETL, las rutas de `/api`, ni `lib/etl` ni `lib/supabase`. Los cálculos nuevos van en [lib/analisis.ts](lib/analisis.ts) y [lib/paleta.ts](lib/paleta.ts).

## Estado actual

### Layout
- [app/page.tsx](app/page.tsx): halo que sigue al cursor ([components/fondo-interactivo.tsx](components/fondo-interactivo.tsx)), navbar y `BancoTrabajo`.
- Navbar flotante en píldora ([components/navbar.tsx](components/navbar.tsx)): Extraer · Proceso · Mapa · Análisis · Filtrar · Subir. «Subir» lleva a `#carga` y enfoca `#boton-guardar`; el logo (solo la nube, `public/img/icono*.webp`) lleva arriba. Sticky, se compacta y pasa a cristal al bajar. Botones de tema ([boton-tema.tsx](components/boton-tema.tsx)) y paleta ([selector-paleta.tsx](components/selector-paleta.tsx)).
- [components/etl/banco-trabajo.tsx](components/etl/banco-trabajo.tsx), a ancho completo y en este orden:
  1. Cabecera sin tarjeta ([cabecera-pagina.tsx](components/etl/cabecera-pagina.tsx), `#inicio`): título, guía 1 Extrae → 2 Revisa → 3 Sube, estado de los datos (sin datos / locales en ámbar / guardado en verde), partículas de clima y una onda al pie.
  2. Barra de configuración (`#configuracion`): chips de ciudades, calendario de rango (máx. 31 días, UTC) y botón «Extraer N registros». Si ya hay datos, pide confirmación.
  3. Pipeline (`#pipeline`): stepper de 5 pasos («Automático» 1-3, «Tú decides» 4-5); al pulsar un paso se despliega su detalle.
  4. Resumen (5 KPIs), mapa (`#mapa`, con carrusel de ciudades), análisis (`#analisis`).
  5. Filtrar (`#seleccion`), revisar los datos + actividad, y guardar en Supabase (`#carga`).
- Mapa, análisis e inspección usan un grid de 4 (`lg:col-span-3` + tarjeta lateral); en móvil, uno debajo del otro.
- Cabecera común de tarjetas: [cabecera-tarjeta.tsx](components/etl/cabecera-tarjeta.tsx) (barra primaria + título + una línea corta) seguida de [SeparadorOnda](components/etl/separador-onda.tsx).
- Textos en lenguaje normal; lo técnico (huella, lotes, URL, HTTP, tiempos) va en [DetallesTecnicos](components/etl/detalles-tecnicos.tsx) plegado o en un tooltip.
- Estados vacíos centrados con icono: [estado-vacio.tsx](components/etl/estado-vacio.tsx).

### Extracción
- La API de Open-Meteo solo se llama desde los botones Extraer y Reintentar.
- Si alguna ciudad no se descarga, el pipeline se detiene: transformación y limpieza quedan «Pendiente».
- 429 (límite por hora): se para en la primera ciudad y aparece un único aviso ámbar con «Reintentar» (vuelve a pedir solo las que faltan). Otros errores, en español y en una línea.
- Solo en desarrollo: cada respuesta correcta se guarda en sessionStorage (clave = URL) y se reutiliza; las ciudades así llevan «desde caché». Entra por el parámetro `fetchFn` de `descargarCiudad`.

### Filtrar y guardar
- Por defecto se sube todo lo que coincide con los filtros; «Elegir filas a mano» activa checkboxes y menú de selección.
- Sliders de rango (temperatura, humedad, precipitación) con límites de los datos (`limitesCampo` en `lib/analisis.ts`); en los extremos no filtran. Chips de ciudad (Todas · …) encima de la tabla. La tabla se ordena pulsando la cabecera. «Quitar filtros» solo si hay alguno activo.
- Botón grande «Guardar N registros en Supabase»; debajo, el estado (listo / subiendo lote x de y con barra / guardado) o el motivo si no se puede.
- Prueba de referencia: [tests/extraccion-septiembre.test.ts](tests/extraccion-septiembre.test.ts) (septiembre × 5 ciudades = 3600 válidos, sin filtrar nada).

### Mapa y análisis
- [seccion-mapa.tsx](components/etl/seccion-mapa.tsx): carrusel de ciudades deslizable ([carrusel-ciudades.tsx](components/etl/carrusel-ciudades.tsx)), selector de métrica en píldoras, mapa de 480px y ranking sincronizado con la ciudad activa (mapa, ranking, carrusel y pestañas comparten la ciudad).
- [mapa-espana.tsx](components/etl/mapa-espana.tsx): teselas MapTiler `dataviz` / `dataviz-dark` (`tileSize={512}`, `zoomOffset={-1}`), `invalidateSize()` + `ResizeObserver` + `fitBounds`. Cada zona se rellena con una escala del `--primary` (estilo en línea en el SVG: Leaflet no admite `var()`); sin datos, gris. La etiqueta muestra los 3 datos al pasar el ratón. `attributionControl={false}`.
- [seccion-analisis.tsx](components/etl/seccion-analisis.tsx): evolución de la temperatura, calidad de los datos y lluvia por ciudad, con colores del tema.
- [actividad-pipeline.tsx](components/etl/actividad-pipeline.tsx): eventos del ETL (máx. 20).

### Variables de entorno
- `NEXT_PUBLIC_MAPTILER_KEY` en `.env.local` (nunca en el código). Documentada en el README y en `.env.example`.
- Si falta, la tarjeta muestra «Falta configurar NEXT_PUBLIC_MAPTILER_KEY».
- Hay que reiniciar `npm run dev` tras cambiarla, porque se incrusta al compilar.

## Pendiente
- **Atribución:** la de «© MapTiler © OpenStreetMap contributors» se quitó. La exigen el plan gratuito de MapTiler y la licencia de OSM. Se puede recuperar sin la bandera con `<AttributionControl prefix={false} />`.

## Criterios de estilo y código
- **Temas** con `next-themes` (`attribute="class"`, `defaultTheme="system"`), tecla `d`. Tokens en [app/globals.css](app/globals.css) (`:root` y `.dark`).
  - Claro: fondo `#fff7fa`, tarjetas blancas, secundario `#fde4ec`, acento `--rosa-pastel` `#f4a7c0`, `--primary` `#c2185b` (texto blanco), texto `#2d1b24` / `#6b4e5c`, `--codigo` `#fdf2f6`.
  - Oscuro: fondo `#140d11`, tarjetas `#22161d`, secundario `#2e1f28`, bordes `#4a3340`, texto `#fbeef3` / `#d8bccb`, `--primary` `#f4a7c0` con texto `#2d1b24`. `--input` `#86687a` (bordes de controles a 3:1). Las tarjetas se separan del fondo por su borde.
  - Ámbar `--aviso` / `--aviso-suave` para «datos sin guardar» y el aviso de límite.
- **Paleta personalizable** ([lib/paleta.ts](lib/paleta.ts)): tono + intensidad en OKLCH, 7 colores rápidos, `light-dark()` en `document.documentElement`, guardada en localStorage y aplicada antes del primer pintado (script en `layout.tsx`). El texto sobre el primario se elige por contraste (AA en todos los tonos). «Restablecer» vuelve a los tokens originales.
- Contraste WCAG AA obligatorio, medido también sobre el centro del halo: tarjetas al 75 % en claro y 70 % en oscuro; el texto sin tarjeta (cabecera y pie) lleva un velo del color de fondo detrás.
- Estados: `exito`/`exito-suave`, `destructive`/`error-suave`, `pendiente`. Sobre `--rosa-pastel` siempre `text-rosa-pastel-foreground`.
- **Formas:** tarjetas `rounded-3xl rounded-tl-[3rem]`, sin borde visible en claro, sombra difusa teñida del primario; cajas internas con fondo secundario suave y `rounded-2xl` (sin cajas dentro de cajas). Chips y pestañas en píldora (activa en primario, inactivas solo texto). Tablas con cabecera sticky y scroll interno. Ondas solo bajo las cabeceras de tarjeta y al pie de la cabecera de la página.
- **Efectos**, todos anulados con `prefers-reduced-motion` ([useMovimientoReducido](hooks/use-movimiento-reducido.ts)): halo que sigue al cursor (700px + centro de 250px), partículas de clima en la cabecera ([clima-cabecera.tsx](components/etl/clima-cabecera.tsx), se pausan fuera de pantalla), aparición de secciones con `data-aparecer`, números que suben desde 0 al llegar datos ([valor-animado.tsx](components/etl/valor-animado.tsx)) y carrusel que se inclina con un brillo sutil. Hover (subir 2px) solo en lo que se pulsa.
- Logo: `public/img/logo.webp` / `logo-oscuro.webp`; en la navbar, `icono.webp` / `icono-oscuro.webp` (solo la nube). Favicon: `app/icon.png`. Título: «DataSky · Pipeline ETL».
- Números con `tabular-nums`. Sin emojis ni mayúsculas decorativas.
- Nombres y comentarios en español, breves. Sin código muerto.
- No pasar Prettier a archivos enteros (reformatea todo con `printWidth: 80`); seguir el formato existente.
- Comprobar `npm run build` antes de subir.
