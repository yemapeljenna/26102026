"use client"

import * as React from "react"
import { ChartNoAxesCombined } from "lucide-react"
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Label, Pie, PieChart, XAxis, YAxis } from "recharts"

import { Card, CardContent } from "@/components/ui/card"
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { resumirPorCiudad, temperaturaDiaria } from "@/lib/analisis"
import { buscarCiudad, CIUDADES } from "@/lib/etl/ciudades"
import { formatoEntero, formatoNumero } from "@/lib/etl/formato"
import type { Medicion } from "@/lib/etl/tipos"
import { CabeceraTarjeta } from "./cabecera-tarjeta"
import { EstadoVacio } from "./estado-vacio"

const VACIO = <EstadoVacio icono={ChartNoAxesCombined}>Extrae datos para ver el análisis</EstadoVacio>

const fechaCorta = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", timeZone: "UTC" })
const fechaLarga = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })
const porcentaje = (parte: number, total: number) => (total ? `${formatoNumero(Math.round((parte / total) * 1000) / 10)} %` : "—")

// Escala del primario para series sin orden propio (las ciudades del donut)
const tonoSerie = (i: number) => `color-mix(in oklch, var(--primary) ${100 - i * 17}%, var(--card))`

export interface CalidadDatos {
  extraidos: number
  validos: number
  rechazadosCalidad: number
  duplicados: number
}

function EvolucionTemperatura({ validos, activa }: { validos: Medicion[]; activa: string }) {
  const nombre = buscarCiudad(activa)!.nombre
  const datos = React.useMemo(() => temperaturaDiaria(validos, nombre), [validos, nombre])
  const resumenes = React.useMemo(() => resumirPorCiudad(validos), [validos])
  const propia = resumenes[nombre]
  const ciudades = Object.values(resumenes)
  const mediaTodas = ciudades.reduce((s, r) => s + r.temperaturaMedia, 0) / (ciudades.length || 1)
  const config = {
    ciudad: { label: nombre, color: "var(--primary)" },
    media: { label: "Media de las ciudades", color: "var(--muted-foreground)" },
  } satisfies ChartConfig

  return (
    <Card className="min-w-0 lg:col-span-3">
      <CabeceraTarjeta titulo="Evolución de la temperatura" subtitulo={`Cada día en ${nombre}, comparado con la media`} />
      <CardContent className="grid gap-4">
        {!validos.length ? (
          VACIO
        ) : (
          <>
            <div className="flex flex-wrap items-end gap-x-6 gap-y-1">
              <p>
                <span className="text-3xl font-bold tabular-nums">{propia ? `${formatoNumero(Math.round(propia.temperaturaMedia * 10) / 10)} °C` : "—"}</span>
                <span className="ml-2 text-sm text-muted-foreground">de media en {nombre}</span>
              </p>
              <p className="text-xs text-muted-foreground">
                Media de las ciudades: <span className="font-medium text-foreground tabular-nums">{formatoNumero(Math.round(mediaTodas * 10) / 10)} °C</span>
              </p>
            </div>
            {!propia && <p className="text-xs text-muted-foreground">{nombre} no está entre las ciudades descargadas.</p>}
            <ChartContainer config={config} className="aspect-auto h-72 w-full">
              <AreaChart data={datos} margin={{ top: 8, right: 8, left: -8 }}>
                <defs>
                  <linearGradient id="relleno-ciudad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-ciudad)" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="var(--color-ciudad)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="dia" tickLine={false} axisLine={false} tickMargin={8} minTickGap={28} tickFormatter={(d: string) => fechaCorta.format(new Date(d))} />
                <YAxis tickLine={false} axisLine={false} width={44} tickFormatter={(v: number) => `${v} °C`} domain={["dataMin - 2", "dataMax + 2"]} allowDecimals={false} />
                <ChartTooltip content={<ChartTooltipContent indicator="line" labelFormatter={(d) => fechaLarga.format(new Date(String(d)))} />} />
                <Area dataKey="media" type="monotone" stroke="var(--color-media)" strokeDasharray="4 4" strokeWidth={1.5} fill="var(--color-media)" fillOpacity={0.06} />
                <Area dataKey="ciudad" type="monotone" stroke="var(--color-ciudad)" strokeWidth={2} fill="url(#relleno-ciudad)" connectNulls />
                <ChartLegend content={<ChartLegendContent />} />
              </AreaChart>
            </ChartContainer>
          </>
        )}
      </CardContent>
    </Card>
  )
}

function CalidadDeLosDatos({ calidad }: { calidad: CalidadDatos | null }) {
  const config = {
    validos: { label: "Válidos", color: "var(--primary)" },
    calidad: { label: "No válidos", color: "var(--destructive)" },
    duplicados: { label: "Repetidos", color: "var(--rosa-pastel)" },
  } satisfies ChartConfig
  const series = calidad
    ? ([
        ["validos", calidad.validos],
        ["calidad", calidad.rechazadosCalidad],
        ["duplicados", calidad.duplicados],
      ] as const)
    : []

  return (
    <Card className="min-w-0">
      <CabeceraTarjeta titulo="Calidad de los datos" subtitulo="Cuántos datos sirven" />
      <CardContent className="grid gap-3">
        {!calidad?.extraidos ? (
          VACIO
        ) : (
          <>
            <ChartContainer config={config} className="aspect-auto h-8 w-full">
              <BarChart data={[Object.fromEntries(series)]} layout="vertical" margin={{ top: 0, right: 0, bottom: 0, left: 0 }} barSize={20}>
                <XAxis type="number" hide domain={[0, calidad.extraidos]} />
                <YAxis type="category" hide />
                {series.map(([k], i) => (
                  <Bar
                    key={k}
                    dataKey={k}
                    stackId="calidad"
                    fill={`var(--color-${k})`}
                    radius={i === 0 ? [6, 0, 0, 6] : i === series.length - 1 ? [0, 6, 6, 0] : 0}
                    isAnimationActive={false}
                  />
                ))}
              </BarChart>
            </ChartContainer>
            <ul className="grid gap-1.5 text-xs">
              {series.map(([k, n]) => (
                <li key={k} className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <span aria-hidden className="size-2.5 rounded-sm" style={{ background: config[k].color }} />
                    {config[k].label}
                  </span>
                  <span className="tabular-nums">
                    <span className="font-semibold">{porcentaje(n, calidad.extraidos)}</span>
                    <span className="ml-1.5 text-muted-foreground">({formatoEntero(n)})</span>
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  )
}

function LluviaPorCiudad({ validos }: { validos: Medicion[] }) {
  const resumenes = React.useMemo(() => resumirPorCiudad(validos), [validos])
  const datos = CIUDADES.filter((c) => resumenes[c.nombre])
    .map((c) => ({ id: c.id, ciudad: c.nombre, mm: Math.round(resumenes[c.nombre].precipitacionTotal * 10) / 10 }))
    .sort((a, b) => b.mm - a.mm)
    .map((d, i) => ({ ...d, fill: tonoSerie(i) }))
  const total = datos.reduce((s, d) => s + d.mm, 0)
  const config = Object.fromEntries(datos.map((d) => [d.id, { label: d.ciudad, color: d.fill }])) satisfies ChartConfig

  return (
    <Card className="min-w-0">
      <CabeceraTarjeta titulo="Lluvia por ciudad" subtitulo="Total del periodo" />
      <CardContent className="grid gap-3">
        {!datos.length ? (
          VACIO
        ) : (
          <>
            <ChartContainer config={config} className="mx-auto aspect-square h-44">
              <PieChart>
                {total > 0 && <ChartTooltip content={<ChartTooltipContent nameKey="id" hideLabel />} />}
                {/* Sin lluvia: un anillo gris para no dejar el hueco vacío */}
                <Pie data={total > 0 ? datos : [{ id: "vacio", mm: 1 }]} dataKey="mm" nameKey="id" innerRadius={52} outerRadius={78} strokeWidth={2} stroke="var(--card)">
                  {total === 0 && <Cell fill="var(--muted)" />}
                  <Label
                    content={({ viewBox }) =>
                      viewBox && "cx" in viewBox ? (
                        <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                          <tspan x={viewBox.cx} y={viewBox.cy} className="fill-foreground text-xl font-bold">
                            {formatoNumero(Math.round(total * 10) / 10)}
                          </tspan>
                          <tspan x={viewBox.cx} y={(viewBox.cy ?? 0) + 18} className="fill-muted-foreground text-xs">
                            mm en total
                          </tspan>
                        </text>
                      ) : null
                    }
                  />
                </Pie>
              </PieChart>
            </ChartContainer>
            <ul className="grid gap-1.5 text-xs">
              {datos.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <span aria-hidden className="size-2.5 rounded-sm" style={{ background: d.fill }} />
                    {d.ciudad}
                  </span>
                  <span className="tabular-nums">
                    <span className="font-semibold">{formatoNumero(d.mm)} mm</span>
                    <span className="ml-1.5 text-muted-foreground">{porcentaje(d.mm, total)}</span>
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  )
}

export function SeccionAnalisis({ validos, activa, calidad }: { validos: Medicion[]; activa: string; calidad: CalidadDatos | null }) {
  return (
    <section id="analisis" data-aparecer aria-label="Análisis" className="grid gap-6 lg:grid-cols-4">
      <EvolucionTemperatura validos={validos} activa={activa} />
      <div className="grid min-w-0 content-start gap-6">
        <CalidadDeLosDatos calidad={calidad} />
        <LluviaPorCiudad validos={validos} />
      </div>
    </section>
  )
}
