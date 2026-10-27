"use client"

import { CircleAlert, Download, TriangleAlert } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { CIUDADES } from "@/lib/etl/ciudades"
import { FECHA_MINIMA_ARCHIVO, MAX_DIAS_EXTRACCION, type ValidacionRango } from "@/lib/etl/fechas"
import { formatoEntero } from "@/lib/etl/formato"

export function SeccionConfiguracion({
  ciudades,
  alCambiarCiudades,
  inicio,
  fin,
  alCambiarInicio,
  alCambiarFin,
  validacion,
  hoy,
  ocupado,
  hayResultados,
  alExtraer,
}: {
  ciudades: string[]
  alCambiarCiudades: (ids: string[]) => void
  inicio: string
  fin: string
  alCambiarInicio: (v: string) => void
  alCambiarFin: (v: string) => void
  validacion: ValidacionRango
  hoy: string
  ocupado: string | null
  hayResultados: boolean
  alExtraer: () => void
}) {
  const errores = [...validacion.errores]
  if (ciudades.length === 0) errores.push("Selecciona al menos una ciudad.")
  const dias = validacion.dias
  const previstos = dias ? ciudades.length * dias * 24 : null
  const alternar = (id: string, marcado: boolean) =>
    alCambiarCiudades(
      CIUDADES.map((c) => c.id).filter((x) => (x === id ? marcado : ciudades.includes(x)))
    )

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>1. Configuración de la extracción</h2>
        </CardTitle>
        <CardDescription>
          API histórica de Open-Meteo · variables horarias de temperatura, humedad relativa y precipitación · horas en UTC, °C y mm.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 xl:grid-cols-[1fr_1fr_1.1fr]">
        <fieldset className="grid gap-2">
          <legend className="mb-2 text-sm font-medium">Ciudades</legend>
          {CIUDADES.map((c) => (
            <Label key={c.id} className="font-normal">
              <Checkbox
                checked={ciudades.includes(c.id)}
                onCheckedChange={(v) => alternar(c.id, v)}
                disabled={!!ocupado}
              />
              {c.nombre}
              <span className="text-xs text-muted-foreground tabular-nums">
                {c.latitud.toFixed(4)}, {c.longitud.toFixed(4)}
              </span>
            </Label>
          ))}
          <div className="mt-1 flex gap-2">
            <Button variant="ghost" size="xs" disabled={!!ocupado} onClick={() => alCambiarCiudades(CIUDADES.map((c) => c.id))}>
              Todas
            </Button>
            <Button variant="ghost" size="xs" disabled={!!ocupado} onClick={() => alCambiarCiudades([])}>
              Ninguna
            </Button>
          </div>
        </fieldset>

        <div className="grid content-start gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="fecha-inicio">Fecha inicial (UTC)</Label>
            <Input
              id="fecha-inicio"
              type="date"
              value={inicio}
              min={FECHA_MINIMA_ARCHIVO}
              max={hoy}
              disabled={!!ocupado}
              aria-invalid={validacion.errores.length > 0}
              onChange={(e) => alCambiarInicio(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="fecha-fin">Fecha final (UTC, incluida)</Label>
            <Input
              id="fecha-fin"
              type="date"
              value={fin}
              min={inicio || FECHA_MINIMA_ARCHIVO}
              max={hoy}
              disabled={!!ocupado}
              aria-invalid={validacion.errores.length > 0}
              onChange={(e) => alCambiarFin(e.target.value)}
            />
          </div>
          <p className="text-xs text-muted-foreground">Máximo {MAX_DIAS_EXTRACCION} días por extracción.</p>
        </div>

        <div className="grid content-start gap-3">
          <div className="rounded-lg bg-muted/60 p-3">
            <p className="text-sm font-medium">Volumen previsto</p>
            {previstos !== null && ciudades.length > 0 ? (
              <>
                <p className="mt-1 text-2xl font-semibold tabular-nums">{formatoEntero(previstos)} registros</p>
                <p className="text-xs text-muted-foreground">
                  {ciudades.length} {ciudades.length === 1 ? "ciudad" : "ciudades"} × {dias} {dias === 1 ? "día" : "días"} × 24 horas ·{" "}
                  {ciudades.length} {ciudades.length === 1 ? "petición" : "peticiones"} HTTP
                </p>
              </>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground">Corrige la configuración para calcularlo.</p>
            )}
          </div>

          {errores.length > 0 && (
            <Alert variant="destructive">
              <CircleAlert />
              <AlertTitle>No se puede extraer todavía</AlertTitle>
              <AlertDescription>
                <ul className="list-disc pl-4">
                  {errores.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}
          {validacion.avisos.map((a) => (
            <Alert key={a}>
              <TriangleAlert />
              <AlertTitle>Aviso</AlertTitle>
              <AlertDescription>{a}</AlertDescription>
            </Alert>
          ))}

          <Button size="lg" disabled={errores.length > 0 || !!ocupado} onClick={alExtraer}>
            <Download />
            Extraer datos
          </Button>
          {ocupado && <p className="text-xs text-muted-foreground">{ocupado}</p>}
          {hayResultados && !ocupado && (
            <p className="text-xs text-muted-foreground">
              Una nueva extracción sustituye los datos locales actuales y vacía la selección.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
