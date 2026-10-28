"use client"

import * as React from "react"
import { CalendarDays, Check, CircleAlert, Download, TriangleAlert } from "lucide-react"
import type { DateRange } from "react-day-picker"
import { es } from "react-day-picker/locale"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Card, CardContent } from "@/components/ui/card"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CIUDADES } from "@/lib/etl/ciudades"
import { FECHA_MINIMA_ARCHIVO, MAX_DIAS_EXTRACCION, type ValidacionRango } from "@/lib/etl/fechas"
import { formatoEntero } from "@/lib/etl/formato"
import { cn } from "@/lib/utils"

// Las fechas son días UTC: "AAAA-MM-DD" ↔ Date a medianoche UTC (el calendario trabaja en UTC)
const aFecha = (s: string) => (s ? new Date(`${s}T00:00:00Z`) : undefined)
const aTexto = (d: Date) => d.toISOString().slice(0, 10)
const formatoDia = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })

function SelectorFechas({
  inicio,
  fin,
  hoy,
  dias,
  invalido,
  deshabilitado,
  alCambiar,
}: {
  inicio: string
  fin: string
  hoy: string
  dias: number | null
  invalido: boolean
  deshabilitado: boolean
  alCambiar: (inicio: string, fin: string) => void
}) {
  const [abierto, setAbierto] = React.useState(false)
  // Rango en edición: solo se aplica cuando tiene inicio y fin
  const [rango, setRango] = React.useState<DateRange | undefined>()
  const actual = { from: aFecha(inicio), to: aFecha(fin) }

  function cambiarAbierto(v: boolean) {
    setAbierto(v)
    setRango(v ? actual : undefined)
  }

  function seleccionar(r: DateRange | undefined) {
    setRango(r)
    if (r?.from && r.to) {
      alCambiar(aTexto(r.from), aTexto(r.to))
      setAbierto(false)
    }
  }

  return (
    <Popover open={abierto} onOpenChange={cambiarAbierto}>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            size="lg"
            disabled={deshabilitado}
            aria-invalid={invalido}
            className="h-10 w-full justify-start gap-2 bg-card font-normal sm:w-auto"
          />
        }
      >
        <CalendarDays aria-hidden className="text-primary" />
        {inicio && fin ? `${formatoDia.format(aFecha(inicio))} – ${formatoDia.format(aFecha(fin))}` : "Elige el periodo"}
        {dias !== null && dias > 0 && <span className="text-xs text-muted-foreground tabular-nums">· {dias} días</span>}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        <Calendar
          mode="range"
          // Con un rango completo, el siguiente clic empieza uno nuevo
          resetOnSelect
          timeZone="UTC"
          locale={es}
          numberOfMonths={2}
          defaultMonth={actual.from}
          selected={rango}
          onSelect={seleccionar}
          // diferencia en días entre los extremos: 30 = 31 días incluidos
          max={MAX_DIAS_EXTRACCION - 1}
          disabled={[{ before: aFecha(FECHA_MINIMA_ARCHIVO)! }, { after: aFecha(hoy)! }]}
          className="p-3"
        />
        <p className="px-3 pb-3 text-xs text-muted-foreground">Elige el primer y el último día (máximo {MAX_DIAS_EXTRACCION}).</p>
      </PopoverContent>
    </Popover>
  )
}

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
  limitado,
  alReintentar,
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
  /** Open-Meteo respondió 429: aviso único con «Reintentar». */
  limitado: boolean
  alReintentar: () => void
}) {
  const [confirmando, setConfirmando] = React.useState(false)
  const errores = [...validacion.errores]
  if (ciudades.length === 0) errores.push("Selecciona al menos una ciudad.")
  const dias = validacion.dias
  const previstos = dias && ciudades.length ? ciudades.length * dias * 24 : null
  const puedeExtraer = errores.length === 0 && !ocupado && previstos !== null
  const alternar = (id: string) =>
    alCambiarCiudades(CIUDADES.map((c) => c.id).filter((x) => (x === id ? !ciudades.includes(id) : ciudades.includes(x))))

  // Solo se pide confirmación si ya hay datos que se van a sustituir
  const extraer = () => (hayResultados ? setConfirmando(true) : alExtraer())

  return (
    <Card id="configuracion" data-aparecer aria-labelledby="titulo-configuracion">
      <h2 id="titulo-configuracion" className="sr-only">
        Configuración de la extracción
      </h2>
      <CardContent className="grid gap-3">
        {/* Barra: ciudades | periodo | botón (apilada en móvil) */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-0 lg:divide-x">
          <fieldset className="grid min-w-0 flex-1 gap-2 lg:pr-5">
            <legend className="mb-2 text-xs font-medium text-muted-foreground">Ciudades</legend>
            <div className="flex flex-wrap items-center gap-1.5">
              {CIUDADES.map((c) => {
                const activa = ciudades.includes(c.id)
                return (
                  <button
                    key={c.id}
                    type="button"
                    aria-pressed={activa}
                    disabled={!!ocupado}
                    onClick={() => alternar(c.id)}
                    className={cn(
                      "inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-sm font-medium transition-colors duration-150 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50",
                      activa ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {activa && <Check aria-hidden className="size-3.5" />}
                    {c.nombre}
                  </button>
                )
              })}
              <span className="ml-1 flex gap-1">
                <Button variant="ghost" size="xs" disabled={!!ocupado || ciudades.length === CIUDADES.length} onClick={() => alCambiarCiudades(CIUDADES.map((c) => c.id))}>
                  Todas
                </Button>
                <Button variant="ghost" size="xs" disabled={!!ocupado || ciudades.length === 0} onClick={() => alCambiarCiudades([])}>
                  Ninguna
                </Button>
              </span>
            </div>
          </fieldset>

          <div className="grid gap-2 lg:px-5">
            <p className="text-xs font-medium text-muted-foreground">Periodo (UTC)</p>
            <SelectorFechas
              inicio={inicio}
              fin={fin}
              hoy={hoy}
              dias={dias}
              invalido={validacion.errores.length > 0}
              deshabilitado={!!ocupado}
              alCambiar={(i, f) => {
                alCambiarInicio(i)
                alCambiarFin(f)
              }}
            />
          </div>

          <div className="grid gap-1 lg:pl-5">
            <Button size="lg" className="h-11 px-5 text-base" disabled={!puedeExtraer} onClick={extraer}>
              <Download />
              {previstos !== null ? `Extraer ${formatoEntero(previstos)} registros` : "Extraer datos"}
            </Button>
            <p className="text-xs text-muted-foreground tabular-nums">
              {ocupado ??
                (previstos !== null
                  ? `${ciudades.length} ${ciudades.length === 1 ? "ciudad" : "ciudades"} × ${dias} ${dias === 1 ? "día" : "días"} × 24 h`
                  : "Elige ciudades y periodo")}
            </p>
          </div>
        </div>

        {limitado && (
          <div role="alert" className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl bg-aviso-suave px-4 py-3 text-sm text-aviso">
            <TriangleAlert aria-hidden className="size-4 shrink-0" />
            <p className="flex-1">Open-Meteo ha recibido demasiadas peticiones esta hora. Prueba de nuevo en un rato.</p>
            <Button variant="outline" size="sm" disabled={!!ocupado} onClick={alReintentar}>
              Reintentar
            </Button>
          </div>
        )}

        {/* Problemas y avisos, en una línea cada uno */}
        {errores.map((e) => (
          <p key={e} className="flex items-center gap-1.5 text-sm text-destructive">
            <CircleAlert aria-hidden className="size-4 shrink-0" />
            {e}
          </p>
        ))}
        {validacion.avisos.map((a) => (
          <p key={a} className="flex items-center gap-1.5 text-sm text-aviso">
            <TriangleAlert aria-hidden className="size-4 shrink-0" />
            {a}
          </p>
        ))}
      </CardContent>

      <AlertDialog open={confirmando} onOpenChange={setConfirmando}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Sustituir los datos actuales?</AlertDialogTitle>
            <AlertDialogDescription>
              Perderás los datos que tienes ahora en el navegador. Lo que ya guardaste en Supabase no se toca.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmando(false)
                alExtraer()
              }}
            >
              Extraer de nuevo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
