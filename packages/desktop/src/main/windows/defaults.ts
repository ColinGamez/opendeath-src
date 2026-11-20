import { resolveThemeVariant } from "@opencode/ui/theme/resolve"
import type { DesktopTheme } from "@opencode/ui/theme/types"
import { desktopZoomLevels } from "@opencode/app/desktop-menu"
import { nativeTheme, type BrowserWindowConstructorOptions } from "electron"
import { Predicate } from "effect"
import oc2ThemeJson from "../../../../ui/src/theme/themes/oc-2.json"
import { BACKGROUND_COLOR_KEY, ZOOM_LEVEL_KEY } from "../storage/keys"
import { getStore } from "../storage/store"

// Frame defaults shared by the early window (created on ready, before the renderer exists) and the
// full window setup in appearance.ts, so both draw the same frame.

// SAFETY: oc-2.json is the bundled default theme, which the UI package loads as a DesktopTheme too.
const oc2Theme = oc2ThemeJson as DesktopTheme

// Match the renderer's 36px titlebar plus its former 8px content inset.
export const titlebarHeight = 44

export function tone() {
  return nativeTheme.shouldUseDarkColors ? "dark" : "light"
}

// The colour the renderer reported on its last run, or the default theme's for the system tone, so
// a window shown before the renderer paints already has the right background. Resolving a palette
// costs tens of milliseconds before the first window, so it only happens when nothing is stored.
export function storedBackgroundColor() {
  const saved = savedBackgroundColor()

  if (saved !== undefined) return saved
  const dark = tone() === "dark"

  return resolveThemeVariant(dark ? oc2Theme.dark : oc2Theme.light, dark)["background-base"]
}

// The colour the renderer reported on its last run, if it ever did.
export function savedBackgroundColor() {
  const stored = getStore().get(BACKGROUND_COLOR_KEY)

  return Predicate.isString(stored) ? stored : undefined
}

// The zoom level chosen in settings or with Zoom In and Zoom Out, or 100% when none was saved.
export function storedZoomLevel() {
  const stored = getStore().get(ZOOM_LEVEL_KEY)

  return desktopZoomLevels.find((level) => level === stored) ?? 1
}

// opendeath: the native overlay is gone (see platformFrame). Kept for the window-state tests that
// still assert the old overlay contract was replaced by renderer-owned caption buttons.
export function titlebarOverlay(mode: "light" | "dark" = tone(), zoom = 1) {
  return {
    color: "#00000000",
    symbolColor: mode === "dark" ? "white" : "black",
    height: Math.max(titlebarHeight, Math.round(titlebarHeight * zoom)),
  }
}

// opendeath: the caption buttons are drawn by the renderer (see shell/titlebar/windows-controls.tsx).
// A native titleBarOverlay always paints an opaque strip over the content on Windows — even with a
// fully transparent colour — so the window is frameless and the strip stays the titlebar's own pixels.
export function platformFrame(_mode: "light" | "dark", _zoom: number) {
  const frame: BrowserWindowConstructorOptions = {}

  if (process.platform === "darwin") {
    frame.titleBarStyle = "hidden"
    frame.trafficLightPosition = { x: 14, y: 14 }
  }

  if (process.platform === "win32") frame.frame = false

  return frame
}
