import { CardAction, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { SeparadorOnda } from "./separador-onda"

/** Cabecera común de las tarjetas: título, una línea corta opcional y, si hace falta, una acción a la derecha. */
export function CabeceraTarjeta({
  titulo,
  subtitulo,
  children,
}: {
  titulo: React.ReactNode
  subtitulo?: React.ReactNode
  children?: React.ReactNode
}) {
  return (
    <>
      <CardHeader>
        <div className="grid min-w-0 gap-1">
          <CardTitle className="flex items-center gap-2.5 text-xl tracking-tight">
            <span aria-hidden className="h-5 w-1 shrink-0 rounded-full bg-primary" />
            <h2>{titulo}</h2>
          </CardTitle>
          {subtitulo && <CardDescription className="pl-3.5">{subtitulo}</CardDescription>}
        </div>
        {children && <CardAction>{children}</CardAction>}
      </CardHeader>
      <SeparadorOnda />
    </>
  )
}
