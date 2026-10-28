/** Separador con una sola onda suave (~6px de amplitud), a todo el ancho y del color del borde. */
export function SeparadorOnda() {
  return (
    <svg aria-hidden viewBox="0 0 100 12" preserveAspectRatio="none" className="block h-3 w-full text-border">
      <path d="M0 6 C 25 0, 75 12, 100 6" fill="none" stroke="currentColor" strokeWidth="1" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}
