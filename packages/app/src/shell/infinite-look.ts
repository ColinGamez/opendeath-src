// Custom background image, custom text color and the moving "rainbow" colors of OpenCode Infinite. Everything lives in the renderer:
// the image is stored (downscaled) in localStorage, and the surfaces are made translucent by overriding their color
// variables inline, so the image shows through and the theme keeps working.
const KEY_IMAGE = "infinite-bg"
const KEY_OPACITY = "infinite-bg-opacity"
const KEY_DIALOG_OPACITY = "infinite-dialog-opacity"
const KEY_FIT = "infinite-bg-fit"
const KEY_POSITION = "infinite-bg-position"
const MAX_SIDE = 2560
// The layers that paint the window; the rest of the interface sits on top of them.
const SURFACES = ["base", "deep", "layer-01", "layer-02", "layer-03", "layer-04"].map(
  (name) => `--v2-background-bg-${name}`,
)

// Text tokens by weight: the full color, then the muted and the faint steps mixed from it.
const TEXTS: [string, number][] = [
  ["--v2-text-text-base", 100],
  ["--text-base", 100],
  ["--text-strong", 100],
  ["--text-stronger", 100],
  ["--v2-text-text-muted", 72],
  ["--text-weak", 72],
  ["--v2-text-text-faint", 52],
  ["--text-weaker", 52],
  // The icons sit beside the text and follow it.
  ["--v2-icon-icon-base", 100],
  ["--v2-icon-icon-muted", 72],
  ["--v2-icon-icon-faint", 52],
]
const KEY_TEXT = "infinite-text-color"
const KEY_RAINBOW = "infinite-rainbow"
export type RainbowTarget = "text" | "background"

const read = (key: string) => {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

export const backgroundFits = ["cover", "contain", "auto"] as const
export const backgroundPositions = ["center", "top", "bottom", "left", "right"] as const
export const getBackground = () => ({
  image: read(KEY_IMAGE) ?? "",
  opacity: clampOpacity(Number(read(KEY_OPACITY) ?? 78)),
  fit: backgroundFits.find((value) => value === read(KEY_FIT)) ?? "cover",
  position: backgroundPositions.find((value) => value === read(KEY_POSITION)) ?? "center",
})

export function setBackgroundLayout(
  fit: (typeof backgroundFits)[number],
  position: (typeof backgroundPositions)[number],
) {
  localStorage.setItem(KEY_FIT, fit)
  localStorage.setItem(KEY_POSITION, position)
  applyBackground()
}

const clampOpacity = (value: number) => (Number.isFinite(value) ? Math.min(100, Math.max(30, Math.round(value))) : 78)

let observer: MutationObserver | undefined
let flowing = false
let lastDrift = -1
// Share of each surface that stays over the background picture; 100 without a picture.
let surfaceAlpha = 100
// Lightness of the rainbow surfaces, in SURFACES order: dark mode, then light mode.
const RAINBOW_SURFACES = { dark: [15, 11, 18, 22, 26, 30], light: [96, 93, 91, 88, 85, 82] }

/** The text color the user picked ("#rrggbb"), or "" for the theme's own. */
export const getTextColor = () => {
  const value = read(KEY_TEXT) ?? ""
  return /^#[0-9a-f]{6}$/i.test(value) ? value : ""
}

// One color for every text weight; undefined gives the theme's colors back.
function paintText(color: string | undefined) {
  const root = document.documentElement
  for (const [name, share] of TEXTS) {
    if (!color) root.style.removeProperty(name)
    else root.style.setProperty(name, share === 100 ? color : `color-mix(in srgb, ${color} ${share}%, transparent)`)
  }
}

/** Saves the picked text color ("" removes it). In the rainbow theme a picked color stops the text from flowing. */
export function setTextColor(color: string) {
  try {
    if (/^#[0-9a-f]{6}$/i.test(color)) localStorage.setItem(KEY_TEXT, color)
    else localStorage.removeItem(KEY_TEXT)
  } catch {}
  paintText(getTextColor() || undefined)
}

// --- accent and corners ----------------------------------------------------------------------------------------
// Both are inline overrides on :root, the same mechanism the text color uses, so a theme change keeps them.

const KEY_ACCENT = "infinite-accent"
const KEY_RADIUS = "infinite-radius"

// Every token that carries the theme's highlight colour, so buttons, links and focus rings move together.
const ACCENTS = [
  "--v2-text-text-accent",
  "--v2-text-text-accent-hover",
  "--v2-icon-icon-accent",
  "--v2-icon-icon-accent-hover",
  "--v2-background-bg-accent",
]

/** The highlight colour the user picked ("#rrggbb"), or "" for the theme's own. */
export const getAccent = () => {
  const value = read(KEY_ACCENT) ?? ""
  return /^#[0-9a-f]{6}$/i.test(value) ? value : ""
}

function paintAccent(color: string | undefined) {
  const root = document.documentElement
  for (const name of ACCENTS) {
    if (!color) root.style.removeProperty(name)
    else root.style.setProperty(name, color)
  }
}

/** Saves the highlight colour ("" gives the theme's own back). */
export function setAccent(color: string) {
  try {
    if (/^#[0-9a-f]{6}$/i.test(color)) localStorage.setItem(KEY_ACCENT, color)
    else localStorage.removeItem(KEY_ACCENT)
  } catch {}
  paintAccent(getAccent() || undefined)
}

// The stock radii from the design tokens. Scaling from these instead of the computed value keeps the
// multiplier stable when the control is dragged back and forth (reading back a scaled value would compound).
const RADIUS_STOCK: Record<string, number> = {
  "--radius-xs": 0.125,
  "--radius-sm": 0.25,
  "--radius-md": 0.375,
  "--radius-lg": 0.5,
  "--radius-xl": 0.625,
}

const clampRadius = (value: number) => (Number.isFinite(value) ? Math.min(200, Math.max(0, Math.round(value))) : 100)

/** Corner roundness in percent: 0 square, 100 the theme's own, 200 fully round. */
export const getRadius = () => clampRadius(Number(read(KEY_RADIUS) ?? 100))

function paintRadius(scale: number) {
  const root = document.documentElement
  for (const [name, base] of Object.entries(RADIUS_STOCK)) {
    root.style.setProperty(name, `${(base * scale) / 100}rem`)
  }
}

/** Saves the roundness and applies it at once. */
export function setRadius(scale: number) {
  try {
    localStorage.setItem(KEY_RADIUS, String(clampRadius(scale)))
  } catch {}
  paintRadius(getRadius())
}

/** Puts accent and corners back; called wherever the look is initialised or restored. */
export function applyPaint() {
  paintAccent(getAccent() || undefined)
  paintRadius(getRadius())
}

/** Paints the stored image (or removes it) and re-reads the surface colors, which change with the theme. */
export function applyBackground() {
  const root = document.documentElement
  const { image, opacity, fit, position } = getBackground()
  for (const name of SURFACES) root.style.removeProperty(name)
  // body and #root paint the same deep color under everything; without a picture they keep it.
  const frame = [document.body, document.getElementById("root")]
  for (const element of frame) element?.style.setProperty("background-color", image ? "transparent" : "")
  surfaceAlpha = 100
  // The settings window repaints the surfaces from these solid colors (see .infinite-settings in index.css).
  const solid = getComputedStyle(root)
  for (const name of SURFACES)
    root.style.setProperty(
      name.replace("--v2-background-bg-", "--infinite-solid-"),
      solid.getPropertyValue(name).trim(),
    )
  root.style.setProperty("--infinite-dialog-alpha", `${getDialogOpacity()}%`)
  if (!image) {
    root.style.removeProperty("background-image")
    return
  }
  // Two translucent layers (window and panel) stack over the picture, so each one gets the alpha that adds up to the setting.
  const alpha = Math.round((1 - Math.sqrt(1 - opacity / 100)) * 100)
  surfaceAlpha = alpha
  root.style.backgroundImage = `url("${image}")`
  root.style.backgroundSize = fit
  root.style.backgroundPosition = position
  root.style.backgroundRepeat = "no-repeat"
  const computed = getComputedStyle(root)
  for (const name of SURFACES) {
    const value = computed.getPropertyValue(name).trim()
    if (value) root.style.setProperty(name, `color-mix(in srgb, ${value} ${alpha}%, transparent)`)
  }
}

/** Decode locally, cap resolution, and save only after a successful import. */
export type BackgroundError =
  | "background.error.type"
  | "background.error.size"
  | "background.error.read"
  | "background.error.storage"

export async function setBackgroundFile(file: File, signal: AbortSignal): Promise<BackgroundError | undefined> {
  if (signal.aborted) return "background.error.read"
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) return "background.error.type"
  if (file.size > 20 * 1024 * 1024) return "background.error.size"
  const url = URL.createObjectURL(file)
  const picture = new Image()
  const decoded = new Promise<boolean>((resolve) => {
    picture.onload = () => resolve(true)
    picture.onerror = () => resolve(false)
    signal.addEventListener("abort", () => resolve(false), { once: true })
    picture.src = url
  })
  try {
    if (!(await decoded) || signal.aborted) return "background.error.read"
    const scale = Math.min(1, MAX_SIDE / Math.max(picture.naturalWidth, picture.naturalHeight))
    const canvas = document.createElement("canvas")
    canvas.width = Math.max(1, Math.round(picture.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(picture.naturalHeight * scale))
    const context = canvas.getContext("2d")
    if (!context) return "background.error.read"
    context.drawImage(picture, 0, 0, canvas.width, canvas.height)
    localStorage.setItem(KEY_IMAGE, canvas.toDataURL("image/webp", 0.85))
    applyBackground()
  } catch {
    return "background.error.storage"
  } finally {
    picture.src = ""
    URL.revokeObjectURL(url)
  }
}

export function clearBackground() {
  try {
    localStorage.removeItem(KEY_IMAGE)
  } catch {}
  applyBackground()
}

/** How much of the settings window stays solid, 30 to 100. */
export const getDialogOpacity = () => clampOpacity(Number(read(KEY_DIALOG_OPACITY) ?? 100))

export function setDialogOpacity(value: number) {
  try {
    localStorage.setItem(KEY_DIALOG_OPACITY, String(clampOpacity(value)))
  } catch {}
  document.documentElement.style.setProperty("--infinite-dialog-alpha", `${getDialogOpacity()}%`)
}

export function setBackgroundOpacity(value: number) {
  try {
    localStorage.setItem(KEY_OPACITY, String(clampOpacity(value)))
  } catch {}
  applyBackground()
}

/** What the rainbow theme moves: only the text, or only the background. Text is the default. */
export const getRainbow = (): RainbowTarget => (read(KEY_RAINBOW) === "background" ? "background" : "text")

/** Saves the rainbow target and puts the look back, so the change is seen at once. */
export function setRainbow(target: RainbowTarget) {
  try {
    localStorage.setItem(KEY_RAINBOW, target)
  } catch {}
  restoreLook()
}

// Back to the theme's own text and background; the rainbow starts again on the next tick if the theme is still rainbow.
function restoreLook() {
  lastDrift = -1
  paintText(getTextColor() || undefined)
  applyPaint()
  applyBackground()
}

// One degree every half second (a full turn in three minutes) so the change is slow enough to read over; a still page
// when the user asks for less motion.
function tickRainbow() {
  const root = document.documentElement
  if (root.dataset.theme !== "rainbow") {
    if (!flowing) return
    flowing = false
    restoreLook()
    return
  }
  flowing = true
  const dark = root.dataset.colorScheme === "dark"
  const drift = Math.floor(Date.now() / 500) % 360
  if (drift === lastDrift) return
  lastDrift = drift
  if (getRainbow() === "background") {
    RAINBOW_SURFACES[dark ? "dark" : "light"].forEach((light, index) => {
      const surface = `hsl(${drift} ${dark ? 60 : 80}% ${light}%)`
      root.style.setProperty(
        SURFACES[index]!,
        surfaceAlpha === 100 ? surface : `color-mix(in srgb, ${surface} ${surfaceAlpha}%, transparent)`,
      )
    })
    return
  }
  // The text takes the opposite hue of the background, lighter (darker in light mode), so it stays readable.
  if (!getTextColor()) paintText(`hsl(${(drift + 180) % 360} 90% ${dark ? 82 : 26}%)`)
}

/** Starts both effects once; the theme machine changes data-theme / data-color-scheme and the style element on every switch. */
export function initLook() {
  if (observer) return
  applyBackground()
  paintText(getTextColor() || undefined)
  applyPaint()
  observer = new MutationObserver(() => applyBackground())
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "data-color-scheme"] })
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return
  setInterval(tickRainbow, 90)
}
