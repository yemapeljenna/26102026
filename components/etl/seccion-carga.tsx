"use client"

import { CircleAlert, CircleCheck, RotateCw, ShieldCheck, Upload } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { EstadoIntegracion } from "@/lib/etl/api-tipos"
import { resumenLotes, TAMANO_LOTE, type EstadoLote } from "@/lib/etl/carga"
import { formatearFechaHora } from "@/lib/etl/fechas"
import { formatoDuracion, formatoEntero } from "@/lib/etl/formato"
import { IndicadorEstado, type EstadoFase } from "./indicador-estado"
import type { Carga } from "./tipos-sesion"

const ESTADO_LOTE: Record<EstadoLote, { fase: EstadoFase; texto: string }> = {
  pendiente: { fase: "pendiente", texto: "Pendiente" },
  enviando: { fase: "en_curso", texto: "Enviando…" },
  completado: { fase: "completada", texto: "Completado" },
  error: { fase: "error", texto: "Error" },
}

export function SeccionCarga({
  integracion,
  totalParaCargar,
  huellaActual,
  carga,
  alSubir,
  alReintentarFallidos,
  alVerDestino,
}: {
  integracion: EstadoIntegracion | null
  totalParaCargar: number
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

  return (
    <Card id="carga">
      <CardHeader>
        <CardTitle>
          <h2>5. Carga en Supabase</h2>
        </CardTitle>
        <CardDescription>
          Upsert por (ciudad, fecha_hora) en lotes de {TAMANO_LOTE} filas como máximo, ejecutado en el servidor con la clave secreta.
          Repetir una carga no duplica filas: actualiza las existentes.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {integracion === null ? (
          <p className="text-sm text-muted-foreground">Comprobando la conexión con Supabase…</p>
        ) : listo ? (
          <p className="flex items-center gap-1.5 text-sm text-emerald-700 dark:text-emerald-400">
            <ShieldCheck className="size-4" aria-hidden />
            {integracion.mensaje}
          </p>
        ) : (
          <Alert variant="destructive">
            <CircleAlert />
            <AlertTitle>La carga no está disponible</AlertTitle>
            <AlertDescription>
              {integracion.mensaje} Consulta el README: variables de entorno y migración SQL.
            </AlertDescription>
          </Alert>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Button size="lg" disabled={!listo || enCurso || totalParaCargar === 0} onClick={alSubir}>
            <Upload />
            {enCurso ? "Carga en curso…" : `Subir ${formatoEntero(totalParaCargar)} registros a Supabase`}
          </Button>
          <p className="text-xs text-muted-foreground">
            Selección actual: {formatoEntero(totalParaCargar)} filas · huella <code className="rounded bg-muted px-1">{huellaActual}</code> ·{" "}
            {Math.ceil(totalParaCargar / TAMANO_LOTE)} {Math.ceil(totalParaCargar / TAMANO_LOTE) === 1 ? "lote" : "lotes"}
          </p>
        </div>

        {carga && resumen && (
          <section aria-labelledby="titulo-ultima-carga" className="grid gap-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 id="titulo-ultima-carga" className="text-sm font-semibold">
                Última carga · conjunto congelado de {formatoEntero(carga.filas.length)} filas · huella{" "}
                <code className="rounded bg-muted px-1 font-normal">{carga.huella}</code>
              </h3>
              {carga.huella !== huellaActual && (
                <p className="text-xs text-muted-foreground">
                  La selección ha cambiado desde que se congeló esta carga; los reintentos usan la copia congelada.
                </p>
              )}
            </div>

            <div className="rounded-lg border">
              <Table aria-label="Estado de los lotes">
                <TableHeader>
                  <TableRow>
                    <TableHead scope="col">Lote</TableHead>
                    <TableHead scope="col">Rango de envío</TableHead>
                    <TableHead scope="col" className="text-right">Filas</TableHead>
                    <TableHead scope="col">Estado</TableHead>
                    <TableHead scope="col" className="text-right">Confirmadas por Supabase</TableHead>
                    <TableHead scope="col" className="text-right">Duración</TableHead>
                    <TableHead scope="col" className="text-right">Intentos</TableHead>
                    <TableHead scope="col">Detalle</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {carga.lotes.map((l) => (
                    <TableRow key={l.numero}>
                      <TableCell className="tabular-nums">{l.numero}</TableCell>
                      <TableCell className="tabular-nums text-xs">
                        {formatoEntero((l.numero - 1) * TAMANO_LOTE + 1)}–{formatoEntero((l.numero - 1) * TAMANO_LOTE + l.filas.length)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatoEntero(l.filas.length)}</TableCell>
                      <TableCell><IndicadorEstado estado={ESTADO_LOTE[l.estado].fase} texto={ESTADO_LOTE[l.estado].texto} /></TableCell>
                      <TableCell className="text-right tabular-nums">{l.confirmadas === undefined ? "—" : formatoEntero(l.confirmadas)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatoDuracion(l.duracionMs)}</TableCell>
                      <TableCell className="text-right tabular-nums">{l.intentos}</TableCell>
                      <TableCell className="max-w-96 text-xs whitespace-normal text-destructive">{l.error}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {!enCurso && (
              <div className="grid gap-3 rounded-lg bg-muted/50 p-3 text-sm" aria-live="polite">
                <p className="font-medium">Informe de la carga ({formatoDuracion(carga.duracionMs)})</p>
                <ul className="grid gap-1">
                  <li>
                    <CircleCheck className="mr-1 inline size-4 text-emerald-700 dark:text-emerald-400" aria-hidden />
                    Procesadas correctamente: <strong className="tabular-nums">{formatoEntero(resumen.filasCorrectas)}</strong> filas en{" "}
                    {resumen.completados} de {resumen.total} lotes ({formatoEntero(resumen.filasConfirmadas)} confirmadas en la respuesta de Supabase).
                  </li>
                  <li>
                    <CircleAlert className="mr-1 inline size-4 text-destructive" aria-hidden />
                    Fallidas: <strong className="tabular-nums">{formatoEntero(resumen.filasFallidas)}</strong> filas en {resumen.fallidos} lotes.
                  </li>
                </ul>
                <p className="text-xs text-muted-foreground">
                  El upsert de Supabase devuelve las filas afectadas, pero no indica cuáles se insertaron y cuáles se actualizaron, así que no se
                  muestran esos recuentos por separado.
                </p>
                {resumen.fallidos > 0 && (
                  <Button variant="outline" className="w-fit" disabled={!listo} onClick={alReintentarFallidos}>
                    <RotateCw />
                    Reintentar {resumen.fallidos} {resumen.fallidos === 1 ? "lote fallido" : "lotes fallidos"}
                  </Button>
                )}

                {v && (
                  <div className="border-t pt-3">
                    <p className="font-medium">Verificación en destino</p>
                    {v.estado === "en_curso" && <p className="text-muted-foreground">Comprobando claves en Supabase…</p>}
                    {v.estado === "error" && <p className="text-destructive">No se pudo verificar: {v.error}</p>}
                    {v.estado === "completada" && (
                      <>
                        <p>
                          {v.faltantes.length === 0 ? (
                            <IndicadorEstado estado="completada" texto={`Las ${formatoEntero(v.encontradas)} claves enviadas en lotes correctos existen en Supabase.`} />
                          ) : (
                            <IndicadorEstado
                              estado="error"
                              texto={`${formatoEntero(v.encontradas)} de ${formatoEntero(v.comprobadas)} claves encontradas; faltan ${formatoEntero(v.faltantes.length)}.`}
                            />
                          )}
                        </p>
                        {v.faltantes.length > 0 && (
                          <ul className="mt-1 max-h-32 overflow-auto text-xs">
                            {v.faltantes.slice(0, 50).map((f) => (
                              <li key={f.ciudad + f.fecha_hora}>{f.ciudad} · {formatearFechaHora(f.fecha_hora)}</li>
                            ))}
                          </ul>
                        )}
                      </>
                    )}
                  </div>
                )}
                <Button variant="link" className="w-fit px-0" onClick={alVerDestino}>
                  Ver los datos persistidos en Supabase
                </Button>
              </div>
            )}
          </section>
        )}
      </CardContent>
    </Card>
  )
}
