"use client"

import { CircleAlert, Info, ListChecks, ListX, RotateCcw } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { CampoOrden, Filtros, Orden, ResultadoSeleccion } from "@/lib/etl/filtros"
import { formatearFechaHora } from "@/lib/etl/fechas"
import { formatoEntero } from "@/lib/etl/formato"
import type { Medicion } from "@/lib/etl/tipos"
import { columnasMedicion } from "./celdas"
import { TablaPaginada, type Columna } from "./tabla-paginada"

const CAMPOS_ORDEN: { valor: CampoOrden; texto: string }[] = [
  { valor: "ciudad", texto: "Ciudad" },
  { valor: "fecha_hora", texto: "Fecha y hora" },
  { valor: "temperatura_c", texto: "Temperatura" },
  { valor: "humedad_pct", texto: "Humedad" },
  { valor: "precipitacion_mm", texto: "Precipitación" },
]

const claseSelect =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm dark:bg-input/30"

function Rango({
  titulo,
  unidad,
  id,
  min,
  max,
  alCambiarMin,
  alCambiarMax,
  paso,
}: {
  titulo: string
  unidad: string
  id: string
  min: string
  max: string
  alCambiarMin: (v: string) => void
  alCambiarMax: (v: string) => void
  paso: string
}) {
  return (
    <fieldset className="grid gap-1.5">
      <legend className="mb-1.5 text-sm font-medium">
        {titulo} <span className="font-normal text-muted-foreground">({unidad})</span>
      </legend>
      <div className="grid grid-cols-2 gap-2">
        <div className="grid gap-1">
          <Label htmlFor={`${id}-min`} className="text-xs font-normal text-muted-foreground">Mínimo</Label>
          <Input id={`${id}-min`} type="number" inputMode="decimal" step={paso} value={min} onChange={(e) => alCambiarMin(e.target.value)} />
        </div>
        <div className="grid gap-1">
          <Label htmlFor={`${id}-max`} className="text-xs font-normal text-muted-foreground">Máximo</Label>
          <Input id={`${id}-max`} type="number" inputMode="decimal" step={paso} value={max} onChange={(e) => alCambiarMax(e.target.value)} />
        </div>
      </div>
    </fieldset>
  )
}

export function SeccionSeleccion({
  ciudadesDisponibles,
  totalValidos,
  filtros,
  alCambiarFiltros,
  orden,
  alCambiarOrden,
  resultado,
  seleccion,
  alCambiarSeleccion,
  alRestablecer,
  cargaEnCurso,
}: {
  ciudadesDisponibles: string[]
  totalValidos: number
  filtros: Filtros
  alCambiarFiltros: (f: Filtros) => void
  orden: Orden
  alCambiarOrden: (o: Orden) => void
  resultado: ResultadoSeleccion
  seleccion: ReadonlySet<string>
  alCambiarSeleccion: (s: Set<string>) => void
  alRestablecer: () => void
  cargaEnCurso: boolean
}) {
  const set = <K extends keyof Filtros>(k: K, v: Filtros[K]) => alCambiarFiltros({ ...filtros, [k]: v })
  const { coincidentes, paraCargar, seleccionadosFueraDeFiltro } = resultado

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

  return (
    <Card id="seleccion">
      <CardHeader>
        <CardTitle>
          <h2>3. Filtrar, ordenar y seleccionar antes de subir</h2>
        </CardTitle>
        <CardDescription>
          Orden de operaciones: datos válidos → filtros → ordenación → selección → carga. La paginación solo afecta a lo que ves.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5">
        {totalValidos === 0 ? (
          <p className="text-sm text-muted-foreground">Aún no hay registros válidos. Extrae datos para empezar.</p>
        ) : (
          <>
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
              <fieldset className="grid content-start gap-1.5">
                <legend className="mb-1.5 text-sm font-medium">Ciudades</legend>
                {ciudadesDisponibles.map((c) => (
                  <Label key={c} className="font-normal">
                    <Checkbox
                      checked={filtros.ciudades.includes(c)}
                      onCheckedChange={(v) =>
                        set("ciudades", v ? [...filtros.ciudades, c] : filtros.ciudades.filter((x) => x !== c))
                      }
                    />
                    {c}
                  </Label>
                ))}
              </fieldset>

              <fieldset className="grid content-start gap-1.5">
                <legend className="mb-1.5 text-sm font-medium">
                  Intervalo de fecha y hora <span className="font-normal text-muted-foreground">(UTC)</span>
                </legend>
                <Label htmlFor="filtro-desde" className="text-xs font-normal text-muted-foreground">Desde</Label>
                <Input id="filtro-desde" type="datetime-local" step={3600} value={filtros.desde} onChange={(e) => set("desde", e.target.value)} />
                <Label htmlFor="filtro-hasta" className="text-xs font-normal text-muted-foreground">Hasta (incluida)</Label>
                <Input id="filtro-hasta" type="datetime-local" step={3600} value={filtros.hasta} onChange={(e) => set("hasta", e.target.value)} />
              </fieldset>

              <div className="grid content-start gap-4">
                <Rango titulo="Temperatura" unidad="°C" id="filtro-temp" paso="0.1" min={filtros.temperaturaMin} max={filtros.temperaturaMax} alCambiarMin={(v) => set("temperaturaMin", v)} alCambiarMax={(v) => set("temperaturaMax", v)} />
                <Rango titulo="Humedad relativa" unidad="%" id="filtro-hum" paso="1" min={filtros.humedadMin} max={filtros.humedadMax} alCambiarMin={(v) => set("humedadMin", v)} alCambiarMax={(v) => set("humedadMax", v)} />
              </div>

              <div className="grid content-start gap-4">
                <Rango titulo="Precipitación" unidad="mm" id="filtro-prec" paso="0.1" min={filtros.precipitacionMin} max={filtros.precipitacionMax} alCambiarMin={(v) => set("precipitacionMin", v)} alCambiarMax={(v) => set("precipitacionMax", v)} />
                <Label className="font-normal">
                  <Checkbox checked={filtros.soloLluvia} onCheckedChange={(v) => set("soloLluvia", v)} />
                  Solo registros con lluvia (precipitación &gt; 0 mm)
                </Label>
                <fieldset className="grid gap-1.5">
                  <legend className="mb-1.5 text-sm font-medium">Ordenación</legend>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="grid gap-1">
                      <Label htmlFor="orden-campo" className="text-xs font-normal text-muted-foreground">Campo</Label>
                      <select id="orden-campo" className={claseSelect} value={orden.campo} onChange={(e) => alCambiarOrden({ ...orden, campo: e.target.value as CampoOrden })}>
                        {CAMPOS_ORDEN.map((c) => (
                          <option key={c.valor} value={c.valor}>{c.texto}</option>
                        ))}
                      </select>
                    </div>
                    <div className="grid gap-1">
                      <Label htmlFor="orden-dir" className="text-xs font-normal text-muted-foreground">Dirección</Label>
                      <select id="orden-dir" className={claseSelect} value={orden.direccion} onChange={(e) => alCambiarOrden({ ...orden, direccion: e.target.value as Orden["direccion"] })}>
                        <option value="asc">Ascendente</option>
                        <option value="desc">Descendente</option>
                      </select>
                    </div>
                  </div>
                </fieldset>
              </div>
            </div>

            {resultado.errores.length > 0 && (
              <Alert variant="destructive">
                <CircleAlert />
                <AlertTitle>Revisa los filtros</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc pl-4">
                    {resultado.errores.map((e) => <li key={e}>{e}</li>)}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="secondary"
                disabled={coincidentes.length === 0 || todasCoincidentesSeleccionadas}
                onClick={() => alternarFilas(coincidentes, true)}
              >
                <ListChecks />
                Seleccionar las {formatoEntero(coincidentes.length)} que coinciden
              </Button>
              <Button variant="outline" disabled={!algunaSeleccionadaCoincide} onClick={() => alternarFilas(coincidentes, false)}>
                Deseleccionar las que coinciden
              </Button>
              <Button variant="outline" disabled={seleccion.size === 0} onClick={() => alCambiarSeleccion(new Set())}>
                <ListX />
                Vaciar selección
              </Button>
              <Button variant="ghost" onClick={alRestablecer}>
                <RotateCcw />
                Restablecer filtros
              </Button>
              <p className="ml-auto text-sm" aria-live="polite">
                <strong className="tabular-nums">{formatoEntero(coincidentes.length)}</strong> coinciden ·{" "}
                <strong className="tabular-nums">{formatoEntero(paraCargar.length)}</strong> seleccionadas para cargar
              </p>
            </div>

            {seleccionadosFueraDeFiltro > 0 && (
              <Alert>
                <Info />
                <AlertTitle>
                  {formatoEntero(seleccionadosFueraDeFiltro)}{" "}
                  {seleccionadosFueraDeFiltro === 1 ? "fila seleccionada queda" : "filas seleccionadas quedan"} fuera de los filtros
                </AlertTitle>
                <AlertDescription>
                  Siguen marcadas, pero no se subirán mientras no cumplan los filtros actuales. Cambiar los filtros nunca selecciona filas nuevas.
                </AlertDescription>
              </Alert>
            )}
            {cargaEnCurso && (
              <p className="text-xs text-muted-foreground">
                Hay una carga en curso con una copia congelada de la selección: los cambios que hagas aquí no la modifican.
              </p>
            )}

            <TablaPaginada
              etiqueta="Registros válidos que coinciden con los filtros"
              filas={coincidentes}
              columnas={[columnaSeleccion, ...columnasMedicion()]}
              claveFila={(m) => m.clave}
              filaResaltada={(m) => seleccion.has(m.clave)}
              vacio="Ningún registro válido cumple los filtros actuales."
            />
          </>
        )}
      </CardContent>
    </Card>
  )
}
