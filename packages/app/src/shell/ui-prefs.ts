import { createSignal } from "solid-js"

// opendeath chrome preferences
//
// Two switches that change the shape of the window rather than its colours, kept apart from the HUD
// layout because they are not slots: they decide how tight the deck is and whether the bottom band
// exists. Both are read on every render from a signal, so flipping one in Settings is the change.

export type DeckDensity = "compact" | "comfortable"

const KEY_DENSITY = "opencode.infinite.deck-density"
const KEY_BAND = "opencode.infinite.status-band"

const read = (key: string) => {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

const write = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Storage can be blocked; the choice then lasts until the app restarts.
  }
}

const [deckDensity, setDensitySignal] = createSignal<DeckDensity>(
  read(KEY_DENSITY) === "compact" ? "compact" : "comfortable",
)

const [statusBand, setBandSignal] = createSignal(read(KEY_BAND) !== "0")

export { deckDensity, statusBand }

export function setDeckDensity(next: DeckDensity) {
  setDensitySignal(next)
  write(KEY_DENSITY, next)
}

export function setStatusBand(next: boolean) {
  setBandSignal(next)
  write(KEY_BAND, next ? "1" : "0")
}
