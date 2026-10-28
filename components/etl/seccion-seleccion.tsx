"use client"

import * as React from "react"
import { Info, ListChecks, ListFilter, ListX, X } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { limitesCampo } from "@/lib/analisis"
import type { CampoOrden, Filtros, Orden, ResultadoSeleccion } from "@/lib/etl/filtros"
import { formatearFechaHora } from "@/lib/etl/fechas"
import { formatoEntero, formatoNumero } from "@/lib/etl/formato"
import type { Medicion } from "@/lib/etl/tipos"
import { CabeceraTarjeta } from "./cabecera-tarjeta"
import { columnasMedicion } from "./celdas"
import { EstadoVacio } from "./estado-vacio"
import { TablaPaginada, type Columna } from "./tabla-paginada"

const ORDENABLES: readonly CampoOrden[] = ["ciudad", "fecha_hora", "temperatura_c", "humedad_pct", "precipitacion_mm"]

// Campos con slider de rango: claves del filtro y paso
const RANGOS = [
  { campo: "temperatura_c", titulo: "Temperatura", unidad: "°C", min: "temperaturaMin", max: "temperaturaMax", paso: 0.1 },
  { campo: "humedad_pct", titulo: "Humedad", unidad: "%", min: "humedadMin", max: "humedadMax", paso: 1 },
  { campo: "precipitacion_mm", titulo: "Precipitación", unidad: "mm", min: "precipitacionMin", max: "precipitacionMax", paso: 0.1 },
] as const

type Rango = (typeof RANGOS)[number]

/** Slider de dos tiradores; en los extremos el filtro queda vacío (sin límite). */
function FiltroRango({
  rango: r,
  limites: [lo, hi],
  filtros,
  alCambiar,
}: {
  rango: Rango
  limites: [number, number]
  filtros: Filtros
  alCambiar: (cambio: Partial<Filtros>) => void
}) {
  const leer = (t: string, porDefecto: number) => (t === "" ? porDefecto : Number(t))
  const valor = [leer(filtros[r.min], lo), leer(filtros[r.max], hi)]
  return (
    <div className="grid gap-3">
      <p className="flex items-baseline justify-between gap-2 text-sm">
        <span className="font-medium">{r.titulo}</span>
        <span className="text-muted-foreground tabular-nums">
          {formatoNumero(valor[0])} – {formatoNumero(valor[1])} {r.unidad}
        </span>
      </p>
      <Slider
        min={lo}
        max={hi}
        step={r.paso}
        value={valor}
        disabled={lo === hi}
        minStepsBetweenValues={0}
        getAriaLabel={(i) => `${r.titulo} ${i === 0 ? "mínima" : "máxima"}`}
        onValueChange={(v) => {
          const [a, b] = v as number[]
          alCambiar({ [r.min]: a <= lo ? "" : String(a), [r.max]: b >= hi ? "" : String(b) })
        }}
      />
    </div>
  )
}

export function SeccionSeleccion({
  ciudadesDisponibles,
  validos,
  filtros,
  alCambiarFiltros,
  orden,
  alCambiarOrden,
  resultado,
  manual,
  alCambiarManual,
  seleccion,
  alCambiarSeleccion,
  alQuitarFiltros,
  cargaEnCurso,
}: {
  ciudadesDisponibles: string[]
  validos: Medicion[]
  filtros: Filtros
  alCambiarFiltros: (f: Filtros) => void
  orden: Orden
  alCambiarOrden: (o: Orden) => void
  resultado: ResultadoSeleccion
  /** Selección a mano activada: aparecen los checkboxes y el menú de selección. */
  manual: boolean
  alCambiarManual: (v: boolean) => void
  seleccion: ReadonlySet<string>
  alCambiarSeleccion: (s: Set<string>) => void
  alQuitarFiltros: () => void
  cargaEnCurso: boolean
}) {
  const cambiar = (c: Partial<Filtros>) => alCambiarFiltros({ ...filtros, ...c })
  const { coincidentes, paraCargar, seleccionadosFueraDeFiltro } = resultado
  const limitesPorCampo = React.useMemo(() => RANGOS.map((r) => limitesCampo(validos, r.campo, r.paso)), [validos])

  const todasLasCiudades = filtros.ciudades.length === ciudadesDisponibles.length
  const hayFiltros =
    !todasLasCiudades || filtros.soloLluvia || RANGOS.some((r) => filtros[r.min] !== "" || filtros[r.max] !== "") || !!filtros.desde || !!filtros.hasta

  const alternarFilas = (filas: Medicion[], marcar: boolean) => {
    const s = new Set(seleccion)
    for (const f of filas) {
      if (marcar) s.add(f.clave)
      else s.delete(f.clave)
    }
    alCambiarSeleccion(s)
  }

  const columnaSeleccion: Columna<Medicion> = {
    id: "seleccion",
    className: "w-10",
    encabezado: (pagina) => {
      const marcadas = pagina.filter((f) => seleccion.has(f.clave)).length
      return (
        <Checkbox
          aria-label="Seleccionar o deseleccionar las filas de esta página"
          checked={pagina.length > 0 && marcadas === pagina.length}
          indeterminate={marcadas > 0 && marcadas < pagina.length}
          disabled={pagina.length === 0}
          onCheckedChange={(v) => alternarFilas(pagina, v)}
        />
      )
    },
    celda: (m) => (
      <Checkbox
        aria-label={`Seleccionar ${m.ciudad} ${formatearFechaHora(m.fecha_hora)}`}
        checked={seleccion.has(m.clave)}
        onCheckedChange={(v) => alternarFilas([m], v)}
      />
    ),
  }

  const algunaSeleccionadaCoincide = paraCargar.length > 0
  const todasCoincidentesSeleccionadas = coincidentes.length > 0 && paraCargar.length === coincidentes.length
  const claseChip = "rounded-full px-3 py-1.5 text-xs font-medium transition-colors duration-150 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 aria-pressed:bg-primary aria-pressed:text-primary-foreground not-aria-pressed:text-muted-foreground not-aria-pressed:hover:text-foreground"

  return (
    <Card id="seleccion" data-aparecer>
      <CabeceraTarjeta titulo="Filtrar" subtitulo="Opcional. Si no filtras nada, se suben todos los registros." />
      <CardContent className="grid gap-5">
        {validos.length === 0 ? (
          <EstadoVacio icono={ListFilter}>Aún no hay datos. Extrae datos para empezar.</EstadoVacio>
        ) : (
          <>
            {/* Una fila en escritorio: tres rangos y «solo lluvia» */}
            <div className="grid items-end gap-x-8 gap-y-5 rounded-2xl bg-secondary/50 p-5 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto]">
              {RANGOS.map((r, i) => (
                <FiltroRango key={r.campo} rango={r} limites={limitesPorCampo[i]} filtros={filtros} alCambiar={cambiar} />
              ))}
              <Label className="font-normal lg:pb-0.5">
                <Checkbox checked={filtros.soloLluvia} onCheckedChange={(v) => cambiar({ soloLluvia: v })} />
                Solo horas con lluvia
              </Label>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Label className="font-normal">
                <Switch checked={manual} onCheckedChange={alCambiarManual} />
                Elegir filas a mano
              </Label>
              {/* Menú de selección: solo en modo manual */}
              {manual && (
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={coincidentes.length === 0 || todasCoincidentesSeleccionadas}
                    onClick={() => alternarFilas(coincidentes, true)}
                  >
                    <ListChecks />
                    Seleccionar las {formatoEntero(coincidentes.length)} que coinciden
                  </Button>
                  <Button variant="outline" size="sm" disabled={!algunaSeleccionadaCoincide} onClick={() => alternarFilas(coincidentes, false)}>
                    Deseleccionar las que coinciden
                  </Button>
                  <Button variant="outline" size="sm" disabled={seleccion.size === 0} onClick={() => alCambiarSeleccion(new Set())}>
                    <ListX />
                    Vaciar selección
                  </Button>
                </div>
              )}
            </div>

            {seleccionadosFueraDeFiltro > 0 && (
              <Alert>
                <Info />
                <AlertTitle>
                  <span className="tabular-nums">{formatoEntero(seleccionadosFueraDeFiltro)}</span>{" "}
                  {seleccionadosFueraDeFiltro === 1 ? "fila elegida no cumple" : "filas elegidas no cumplen"} los filtros
                </AlertTitle>
                <AlertDescription>No se subirán mientras no los cumplan.</AlertDescription>
              </Alert>
            )}
            {cargaEnCurso && <p className="text-xs text-muted-foreground">Hay una subida en marcha. Lo que cambies aquí no le afecta.</p>}

            <div className="grid gap-3">
              {/* Encima de la tabla: ciudad y recuento */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <div role="group" aria-label="Ciudad" className="flex flex-wrap gap-1.5">
                  <button type="button" aria-pressed={todasLasCiudades} onClick={() => cambiar({ ciudades: [...ciudadesDisponibles] })} className={claseChip}>
                    Todas
                  </button>
                  {ciudadesDisponibles.map((c) => (
                    <button
                      key={c}
                      type="button"
                      aria-pressed={!todasLasCiudades && filtros.ciudades.length === 1 && filtros.ciudades[0] === c}
                      onClick={() => cambiar({ ciudades: [c] })}
                      className={claseChip}
                    >
                      {c}
                    </button>
                  ))}
                </div>
                <div className="ml-auto flex items-center gap-3">
                  <p className="text-sm" aria-live="polite">
                    {manual ? (
                      <>
                        <strong className="tabular-nums">{formatoEntero(paraCargar.length)}</strong> de{" "}
                        <span className="tabular-nums">{formatoEntero(coincidentes.length)}</span> elegidas
                      </>
                    ) : (
                      <>
                        <strong className="text-lg tabular-nums">{formatoEntero(coincidentes.length)}</strong> registros para subir
                      </>
                    )}
                  </p>
                  {hayFiltros && (
                    <Button variant="ghost" size="sm" onClick={alQuitarFiltros}>
                      <X />
                      Quitar filtros
                    </Button>
                  )}
                </div>
              </div>

              <TablaPaginada
                etiqueta="Registros que coinciden con los filtros"
                filas={coincidentes}
                columnas={manual ? [columnaSeleccion, ...columnasMedicion()] : columnasMedicion()}
                claveFila={(m) => m.clave}
                filaResaltada={manual ? (m) => seleccion.has(m.clave) : undefined}
                orden={{ columna: orden.campo, direccion: orden.direccion, ordenables: ORDENABLES }}
                alOrdenar={(c) =>
                  alCambiarOrden(
                    c === orden.campo ? { ...orden, direccion: orden.direccion === "asc" ? "desc" : "asc" } : { campo: c as CampoOrden, direccion: "asc" }
                  )
                }
                vacio="Ningún registro coincide con los filtros."
              />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
