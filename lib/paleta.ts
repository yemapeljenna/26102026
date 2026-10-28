/** Paleta de color a partir de un tono (0-360) en OKLCH, con luminosidad fija para cada tema. */

export const TONO_ROSA = 0
// Intensidad = croma del primario en tema claro; el resto de roles se escala en proporción
export const CROMA_ROSA = 0.2
export const CROMA_MIN = 0
export const CROMA_MAX = 0.26
export const CLAVE_PALETA = "paleta"

// Tono y croma de cada color rápido; el resto se elige con las barras
export const TONOS_RAPIDOS = [
  { nombre: "Rosa", tono: TONO_ROSA, croma: CROMA_ROSA },
  { nombre: "Rojo", tono: 27, croma: 0.22 },
  { nombre: "Naranja", tono: 50, croma: 0.18 },
  { nombre: "Amarillo", tono: 95, croma: 0.16 },
  { nombre: "Verde", tono: 150, croma: 0.17 },
  { nombre: "Azul", tono: 255, croma: 0.19 },
  { nombre: "Morado", tono: 305, croma: 0.2 },
]

// Variables que se sustituyen; el resto del tema no cambia.
export const VARIABLES_PALETA = [
  "--primary",
  "--primary-foreground",
  "--ring",
  "--rosa-pastel",
  "--secondary",
  "--muted",
  "--accent",
  "--border",
  "--input",
  "--fondo-fin",
] as const

type Rgb = [number, number, number]

// Luminosidad y croma objetivo de cada rol, según el tema (calibrados con el rosa original)
const ROLES = {
  claro: { primario: [0.53, 0.2], acento: [0.81, 0.1], secundario: [0.94, 0.03], borde: [0.9, 0.04], input: [0.9, 0.04], fondoFin: [0.94, 0.03] },
  oscuro: { primario: [0.81, 0.1], acento: [0.81, 0.1], secundario: [0.261, 0.028], borde: [0.352, 0.039], input: [0.56, 0.045], fondoFin: [0.205, 0.02] },
} as const

const TEXTO_CLARO = "#ffffff"
const TEXTO_OSCURO = "#2d1b24"

/** OKLCH → sRGB lineal (sin recortar). */
function oklchALineal(l: number, c: number, h: number): Rgb {
  const a = c * Math.cos((h * Math.PI) / 180)
  const b = c * Math.sin((h * Math.PI) / 180)
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3
  return [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  ]
}

const enGama = (rgb: Rgb) => rgb.every((v) => v >= -1e-4 && v <= 1 + 1e-4)

/** Reduce el croma hasta que el color cabe en sRGB. */
function ajustarCroma(l: number, c: number, h: number): number {
  if (enGama(oklchALineal(l, c, h))) return c
  let min = 0
  let max = c
  for (let i = 0; i < 20; i++) {
    const medio = (min + max) / 2
    if (enGama(oklchALineal(l, medio, h))) min = medio
    else max = medio
  }
  return min
}

/** Luminancia relativa (WCAG) de un color en sRGB lineal. */
const luminancia = ([r, g, b]: Rgb) => 0.2126 * r + 0.7152 * g + 0.0722 * b

function luminanciaHex(hex: string): number {
  const canal = (i: number) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  }
  return luminancia([canal(1), canal(3), canal(5)])
}

const contraste = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)

/** Texto (blanco u oscuro) con más contraste sobre el primario; con estas luminosidades siempre ≥ 4,5:1. */
function textoSobre(rgb: Rgb): string {
  const fondo = luminancia(rgb.map((v) => Math.min(1, Math.max(0, v))) as Rgb)
  const claro = contraste(fondo, luminanciaHex(TEXTO_CLARO))
  const oscuro = contraste(fondo, luminanciaHex(TEXTO_OSCURO))
  return claro >= oscuro ? TEXTO_CLARO : TEXTO_OSCURO
}

function color(l: number, c: number, h: number) {
  const croma = ajustarCroma(l, c, h)
  return { css: `oklch(${l} ${croma.toFixed(3)} ${h})`, rgb: oklchALineal(l, croma, h) }
}

type Roles = (typeof ROLES)["claro" | "oscuro"]

function primario(tono: number, croma: number, roles: Roles) {
  return color(roles.primario[0], roles.primario[1] * (croma / CROMA_ROSA), tono)
}

function tema(tono: number, croma: number, roles: Roles) {
  const f = croma / CROMA_ROSA
  const color_ = (rol: readonly [number, number]) => color(rol[0], rol[1] * f, tono)
  const prim = primario(tono, croma, roles)
  const secundario = color_(roles.secundario).css
  return {
    "--primary": prim.css,
    "--primary-foreground": textoSobre(prim.rgb),
    "--ring": prim.css,
    "--rosa-pastel": color_(roles.acento).css,
    "--secondary": secundario,
    "--muted": secundario,
    "--accent": secundario,
    "--border": color_(roles.borde).css,
    "--input": color_(roles.input).css,
    "--fondo-fin": color_(roles.fondoFin).css,
  }
}

/** Variables CSS del tono; cada una lleva ambos temas con light-dark(), así no hay que recalcular al cambiar de tema. */
export function generarPaleta(tono: number, croma: number): Record<string, string> {
  const claro = tema(tono, croma, ROLES.claro)
  const oscuro = tema(tono, croma, ROLES.oscuro)
  return Object.fromEntries(
    VARIABLES_PALETA.map((v) => [v, claro[v] === oscuro[v] ? claro[v] : `light-dark(${claro[v]}, ${oscuro[v]})`])
  )
}

/** Script en línea para aplicar la paleta guardada antes del primer pintado. */
export const SCRIPT_PALETA = `try{var p=JSON.parse(localStorage.getItem("${CLAVE_PALETA}"));if(p&&p.variables)for(var k in p.variables)document.documentElement.style.setProperty(k,p.variables[k])}catch(e){}`
