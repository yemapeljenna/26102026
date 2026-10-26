"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatoEntero } from "@/lib/etl/formato"
import { cn } from "@/lib/utils"

export const TAMANOS_PAGINA = [25, 50, 100] as const

export interface Columna<T> {
  id: string
  /** Puede depender de las filas visibles (p. ej. casilla «seleccionar página»). */
  encabezado: React.ReactNode | ((filasPagina: T[]) => React.ReactNode)
  unidad?: string
  celda: (fila: T, indiceGlobal: number) => React.ReactNode
  numerica?: boolean
  className?: string
}

export function Paginador({
  pagina,
  total,
  tamano,
  alCambiarPagina,
  alCambiarTamano,
}: {
  pagina: number
  total: number
  tamano: number
  alCambiarPagina: (p: number) => void
  alCambiarTamano: (t: number) => void
}) {
  const paginas = Math.max(1, Math.ceil(total / tamano))
  const desde = total === 0 ? 0 : pagina * tamano + 1
  const hasta = Math.min(total, (pagina + 1) * tamano)
  const idTamano = React.useId()
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 pt-3 text-xs text-muted-foreground">
      <p aria-live="polite">
        Filas {formatoEntero(desde)}–{formatoEntero(hasta)} de {formatoEntero(total)} · Página{" "}
        {formatoEntero(pagina + 1)} de {formatoEntero(paginas)}
      </p>
      <div className="flex flex-wrap items-center gap-1">
        <label htmlFor={idTamano} className="mr-1">
          Filas por página
        </label>
        <select
          id={idTamano}
          className="h-7 rounded-md border border-input bg-background px-1.5 text-xs text-foreground"
          value={tamano}
          onChange={(e) => alCambiarTamano(Number(e.target.value))}
        >
          {TAMANOS_PAGINA.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <Button variant="outline" size="icon-sm" aria-label="Primera página" disabled={pagina === 0} onClick={() => alCambiarPagina(0)}>
          <ChevronsLeft />
        </Button>
        <Button variant="outline" size="icon-sm" aria-label="Página anterior" disabled={pagina === 0} onClick={() => alCambiarPagina(pagina - 1)}>
          <ChevronLeft />
        </Button>
        <Button variant="outline" size="icon-sm" aria-label="Página siguiente" disabled={pagina >= paginas - 1} onClick={() => alCambiarPagina(pagina + 1)}>
          <ChevronRight />
        </Button>
        <Button variant="outline" size="icon-sm" aria-label="Última página" disabled={pagina >= paginas - 1} onClick={() => alCambiarPagina(paginas - 1)}>
          <ChevronsRight />
        </Button>
      </div>
    </div>
  )
}

export function EncabezadoColumna({ titulo, unidad }: { titulo: React.ReactNode; unidad?: string }) {
  return (
    <span className="inline-flex flex-col leading-tight">
      <span>{titulo}</span>
      {unidad && <span className="text-[0.7rem] font-normal text-muted-foreground">{unidad}</span>}
    </span>
  )
}

/** Tabla con paginación local. Recibe el conjunto completo ya filtrado y ordenado. */
export function TablaPaginada<T>({
  filas,
  columnas,
  claveFila,
  etiqueta,
  vacio,
  filaResaltada,
}: {
  filas: T[]
  columnas: Columna<T>[]
  claveFila: (fila: T) => string
  etiqueta: string
  vacio: React.ReactNode
  filaResaltada?: (fila: T) => boolean
}) {
  const [pagina, setPagina] = React.useState(0)
  const [tamano, setTamano] = React.useState<number>(TAMANOS_PAGINA[0])
  const paginas = Math.max(1, Math.ceil(filas.length / tamano))
  // Si el conjunto se reduce, se muestra la última página existente.
  const paginaVisible = Math.min(pagina, paginas - 1)
  const inicio = paginaVisible * tamano
  const filasPagina = filas.slice(inicio, inicio + tamano)

  return (
    <div>
      <div className="rounded-lg border">
        <Table aria-label={etiqueta}>
          <TableHeader>
            <TableRow>
              {columnas.map((c) => (
                <TableHead
                  key={c.id}
                  scope="col"
                  className={cn("h-auto py-2 align-bottom", c.numerica && "text-right", c.className)}
                >
                  {typeof c.encabezado === "function" ? (
                    c.encabezado(filasPagina)
                  ) : (
                    <EncabezadoColumna titulo={c.encabezado} unidad={c.unidad} />
                  )}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filasPagina.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columnas.length} className="py-8 text-center whitespace-normal text-muted-foreground">
                  {vacio}
                </TableCell>
              </TableRow>
            ) : (
              filasPagina.map((f, i) => (
                <TableRow key={claveFila(f)} data-state={filaResaltada?.(f) ? "selected" : undefined}>
                  {columnas.map((c) => (
                    <TableCell
                      key={c.id}
                      className={cn(c.numerica && "text-right tabular-nums", c.className)}
                    >
                      {c.celda(f, inicio + i)}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <Paginador
        pagina={paginaVisible}
        total={filas.length}
        tamano={tamano}
        alCambiarPagina={setPagina}
        alCambiarTamano={(t) => {
          setTamano(t)
          setPagina(0)
        }}
      />
    </div>
  )
}
