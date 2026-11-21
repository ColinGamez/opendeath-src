import { createSignal } from "solid-js"

// opendeath HUD layout
//
// The Infinite deck is a strip of controls, and the order that suits one machine rarely suits the
// next. This module owns the one saved answer: which items show, and in what order. It is the only
// place that reads or writes the layout, so the deck, the HUD editor and the settings panel can
// never disagree about it.
//
// The registry lives here rather than in the deck because the merge rule needs it: a build that adds
// a new control must place it without wiping the saved order of the others, and a build that drops
// one must not leave a hole. `merge` does both.

/** Every control the deck can show. Adding one here is the whole job; the editor and merge follow. */
export const HUD_ITEMS = [
  "brand",
  "connection",
  "fix",
  "status",
  "help",
  "resetLimit",
  "rotateNow",
  "jailbreak",
  "autoRotate",
  "settings",
  "spacer",
  "readout",
] as const

export type HudItem = (typeof HUD_ITEMS)[number]

export type HudLayout = {
  order: HudItem[]
  hidden: HudItem[]
}

const KEY = "opencode.infinite.hud"

const isItem = (value: unknown): value is HudItem =>
  typeof value === "string" && (HUD_ITEMS as readonly string[]).includes(value)

/** Stored order first, then anything new in registry order; unknown or duplicate ids are dropped. */
function merge(order: unknown, hidden: unknown): HudLayout {
  const seen = new Set<HudItem>()
  const resolved: HudItem[] = []
  for (const value of Array.isArray(order) ? order : []) {
    if (!isItem(value) || seen.has(value)) continue
    seen.add(value)
    resolved.push(value)
  }
  for (const item of HUD_ITEMS) {
    if (seen.has(item)) continue
    seen.add(item)
    resolved.push(item)
  }
  const off = new Set<HudItem>()
  for (const value of Array.isArray(hidden) ? hidden : []) if (isItem(value)) off.add(value)
  return { order: resolved, hidden: [...off] }
}

function read(): HudLayout {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "null") as { order?: unknown; hidden?: unknown } | null
    return merge(raw?.order, raw?.hidden)
  } catch {
    return merge(undefined, undefined)
  }
}

const [hudLayout, setHudLayoutSignal] = createSignal<HudLayout>(read())

export { hudLayout }

/** True while the deck is in edit mode; the status band and Settings both open it. */
export const [hudEditing, setHudEditing] = createSignal(false)

function commit(next: HudLayout) {
  setHudLayoutSignal(next)
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // Storage can be blocked; the layout then lasts until the app restarts.
  }
}

/** The items in saved order, without the hidden ones. */
export function visibleItems() {
  const { order, hidden } = hudLayout()
  const off = new Set(hidden)
  return order.filter((item) => !off.has(item))
}

export function isHidden(item: HudItem) {
  return hudLayout().hidden.includes(item)
}

export function setHidden(item: HudItem, hidden: boolean) {
  const layout = hudLayout()
  const next = hidden ? [...layout.hidden, item] : layout.hidden.filter((entry) => entry !== item)
  commit({ order: layout.order, hidden: [...new Set(next)] })
}

/**
 * Moves `item` so it lands at `index`. With `visibleOnly` the index counts shown slots, which is what a
 * drag on the deck reports: hidden items keep their places and the drop lands where the eye saw it.
 */
export function moveItem(item: HudItem, index: number, visibleOnly = false) {
  const layout = hudLayout()
  const order = [...layout.order]
  const from = order.indexOf(item)
  if (from < 0) return
  order.splice(from, 1)

  if (!visibleOnly) {
    order.splice(Math.min(Math.max(index, 0), order.length), 0, item)
  } else {
    const slots = order.filter((entry) => !layout.hidden.includes(entry))
    const clamped = Math.min(Math.max(index, 0), slots.length - 1)
    const anchor = slots[clamped]
    // Appending at the end of the visible run, or an empty run, both land after everything shown.
    const at = anchor === undefined ? order.length : order.indexOf(anchor) + (index > clamped ? 1 : 0)
    order.splice(Math.min(at, order.length), 0, item)
  }

  commit({ order, hidden: layout.hidden })
}

/** Back to the shipped order with everything visible. */
export function resetHud() {
  commit(merge(undefined, undefined))
}

/** Share of the deck's controls that are showing, for the settings summary. */
export function hudSummary() {
  const hidden = hudLayout().hidden.length
  return `${HUD_ITEMS.length - hidden} of ${HUD_ITEMS.length} shown`
}
