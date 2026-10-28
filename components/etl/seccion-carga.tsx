"use client"

import { CircleAlert, CircleCheck, Info, RotateCw, Upload } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { EstadoIntegracion } from "@/lib/etl/api-tipos"
import { resumenLotes, TAMANO_LOTE, type EstadoLote } from "@/lib/etl/carga"
import { formatearFechaHora } from "@/lib/etl/fechas"
import { formatoDuracion, formatoEntero } from "@/lib/etl/formato"
import { CabeceraTarjeta } from "./cabecera-tarjeta"
import { DetallesTecnicos } from "./detalles-tecnicos"
import { IndicadorEstado, type EstadoFase } from "./indicador-estado"
import type { Carga } from "./tipos-sesion"

const ESTADO_LOTE: Record<EstadoLote, { fase: EstadoFase; texto: string }> = {
  pendiente: { fase: "pendiente", texto: "Pendiente" },
  enviando: { fase: "en_curso", texto: "Enviando…" },
  completado: { fase: "completada", texto: "Completado" },
  error: { fase: "error", texto: "Error" },
}

const registros = (n: number) => `${formatoEntero(n)} ${n === 1 ? "registro" : "registros"}`

export function SeccionCarga({
  integracion,
  totalParaCargar,
  totalValidos,
  totalCoinciden,
  huellaActual,
  carga,
  alSubir,
  alReintentarFallidos,
  alVerDestino,
}: {
  integracion: EstadoIntegracion | null
  totalParaCargar: number
  totalValidos: number
  totalCoinciden: number
  huellaActual: string
  carga: Carga | null
  alSubir: () => void
  alReintentarFallidos: () => void
  alVerDestino: () => void
}) {
  const listo = !!integracion?.habilitado && integracion.configurado && integracion.tablaDisponible
  const enCurso = !!carga?.enCurso
  const resumen = carga ? resumenLotes(carga.lotes) : null
  const v = carga?.verificacion
  // Por qué no se puede guardar, en una línea (null si se puede)
  const motivo =
    integracion === null
      ? "Comprobando la conexión con Supabase…"
      : !listo
        ? "Supabase no está configurado."
        : enCurso
          ? null
          : totalValidos === 0
            ? "Primero extrae datos."
            : totalCoinciden === 0
              ? "Ningún registro coincide con los filtros."
              : totalParaCargar === 0
                ? "No has elegido ninguna fila."
                : null
  const lotesTerminados = resumen ? resumen.completados + resumen.fallidos : 0
  const loteActual = carga?.lotes.find((l) => l.estado === "enviando")?.numero ?? lotesTerminados + 1

  return (
    // tabIndex -1: el enlace «Subir» de la navbar puede enfocar la tarjeta si el botón está desactivado
    <Card id="carga" data-aparecer tabIndex={-1} className="outline-none">
      <CabeceraTarjeta titulo="Guardar en Supabase" subtitulo="Si los subes dos veces, no se duplican." />
      <CardContent className="grid gap-5">
        {integracion && !listo && (
          <Alert variant="destructive">
            <CircleAlert />
            <AlertTitle>No se puede guardar todavía</AlertTitle>
            <AlertDescription>{integracion.mensaje} Mira el README para configurarlo.</AlertDescription>
          </Alert>
        )}

        <div className="grid gap-3">
          <Button id="boton-guardar" size="lg" className="h-14 w-full text-base sm:text-lg" disabled={enCurso || motivo !== null} onClick={alSubir} aria-describedby="estado-carga">
            <Upload className="size-5" />
            {enCurso ? "Guardando…" : `Guardar ${registros(totalParaCargar)} en Supabase`}
          </Button>

          {/* Estado: preparado / subiendo / guardado */}
          <div id="estado-carga" aria-live="polite" className="grid gap-2">
            {enCurso && resumen ? (
              <>
                <p className="flex justify-between text-sm">
                  <span>
                    Subiendo lote <span className="tabular-nums">{Math.min(loteActual, resumen.total)}</span> de{" "}
                    <span className="tabular-nums">{resumen.total}</span>
                  </span>
                  <span className="text-muted-foreground tabular-nums">{Math.round((lotesTerminados / resumen.total) * 100)} %</span>
                </p>
                <div role="progressbar" aria-label="Progreso de la subida" aria-valuemin={0} aria-valuemax={resumen.total} aria-valuenow={lotesTerminados} className="h-2 overflow-hidden rounded-full bg-secondary">
                  <div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${(lotesTerminados / resumen.total) * 100}%` }} />
                </div>
              </>
            ) : carga && resumen && resumen.filasCorrectas > 0 ? (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl bg-exito-suave px-4 py-3 text-exito">
                <CircleCheck className="size-5 shrink-0" aria-hidden />
                <p className="font-semibold">
                  <span className="tabular-nums">{registros(resumen.filasCorrectas)}</span> guardados en Supabase
                </p>
                <Button variant="link" className="h-auto px-0 text-exito" onClick={alVerDestino}>
                  Ver lo guardado
                </Button>
              </div>
            ) : (
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                {motivo ? <Info className="size-4 shrink-0" aria-hidden /> : <CircleCheck className="size-4 shrink-0 text-exito" aria-hidden />}
                {motivo ?? "Todo listo para guardar."}
              </p>
            )}

            {/* Fallos y comprobación final, solo si los hay */}
            {!enCurso && resumen && resumen.fallidos > 0 && (
              <div className="flex flex-wrap items-center gap-3 text-sm text-destructive">
                <span className="flex items-center gap-1.5">
                  <CircleAlert className="size-4 shrink-0" aria-hidden />
                  <span className="tabular-nums">{registros(resumen.filasFallidas)}</span> no se pudieron guardar.
                </span>
                <Button variant="outline" size="sm" disabled={!listo} onClick={alReintentarFallidos}>
                  <RotateCw />
                  Reintentar
                </Button>
              </div>
            )}
            {!enCurso && v?.estado === "completada" && v.faltantes.length > 0 && (
              <p className="flex items-center gap-1.5 text-sm text-destructive">
                <CircleAlert className="size-4 shrink-0" aria-hidden />
                Faltan <span className="tabular-nums">{formatoEntero(v.faltantes.length)}</span> registros en Supabase. Revisa los detalles técnicos.
              </p>
            )}
            {!enCurso && v?.estado === "error" && <p className="text-sm text-destructive">No se pudo comprobar lo guardado: {v.error}</p>}
          </div>
        </div>

        <DetallesTecnicos>
          <p>
            Se envían en lotes de <span className="tabular-nums">{TAMANO_LOTE}</span> filas con un upsert por (ciudad, fecha_hora) en el servidor. Huella
            de la selección actual: <code className="rounded bg-muted px-1">{huellaActual}</code>.
          </p>
          {carga && resumen && (
            <>
              <p>
                Última carga: <span className="tabular-nums">{formatoEntero(carga.filas.length)}</span> filas congeladas · huella{" "}
                <code className="rounded bg-muted px-1">{carga.huella}</code> · {formatoDuracion(carga.duracionMs)} ·{" "}
                <span className="tabular-nums">{formatoEntero(resumen.filasConfirmadas)}</span> confirmadas en la respuesta de Supabase.
                {carga.huella !== huellaActual && " La selección ha cambiado desde entonces; los reintentos usan la copia congelada."}
              </p>
              {v?.estado === "completada" && (
                <p>
                  Comprobación: <span className="tabular-nums">{formatoEntero(v.encontradas)}</span> de{" "}
                  <span className="tabular-nums">{formatoEntero(v.comprobadas)}</span> claves encontradas en Supabase.
                </p>
              )}
              {v && v.faltantes.length > 0 && (
                <ul className="max-h-32 overflow-auto">
                  {v.faltantes.slice(0, 50).map((f) => (
                    <li key={f.ciudad + f.fecha_hora}>
                      Falta {f.ciudad} · {formatearFechaHora(f.fecha_hora)}
                    </li>
                  ))}
                </ul>
              )}
              <div className="overflow-hidden rounded-2xl bg-card text-foreground">
                <Table aria-label="Estado de los lotes">
                  <TableHeader>
                    <TableRow>
                      <TableHead scope="col">Lote</TableHead>
                      <TableHead scope="col" className="text-right">Filas</TableHead>
                      <TableHead scope="col">Estado</TableHead>
                      <TableHead scope="col" className="text-right">Confirmadas</TableHead>
                      <TableHead scope="col" className="text-right">Duración</TableHead>
                      <TableHead scope="col" className="text-right">Intentos</TableHead>
                      <TableHead scope="col">Detalle</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {carga.lotes.map((l) => (
                      <TableRow key={l.numero}>
                        <TableCell className="tabular-nums">{l.numero}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatoEntero(l.filas.length)}</TableCell>
                        <TableCell>
                          <IndicadorEstado estado={ESTADO_LOTE[l.estado].fase} texto={ESTADO_LOTE[l.estado].texto} />
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{l.confirmadas === undefined ? "—" : formatoEntero(l.confirmadas)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatoDuracion(l.duracionMs)}</TableCell>
                        <TableCell className="text-right tabular-nums">{l.intentos}</TableCell>
                        <TableCell className="max-w-96 text-xs whitespace-normal text-destructive">{l.error}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </DetallesTecnicos>
      </CardContent>
    </Card>
  )
}
