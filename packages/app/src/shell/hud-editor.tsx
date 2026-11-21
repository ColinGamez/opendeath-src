import { For, createSignal } from "solid-js"
import {
  hudLayout,
  isHidden,
  moveItem,
  resetHud,
  setHidden,
  type HudItem,
} from "@/shell/hud-layout"

// opendeath HUD editor
//
// One list, dragged or nudged, that is the deck's actual order. It writes straight to the layout store,
// so the strip behind it changes while you work and there is nothing to save afterwards — the same
// "applied at once" contract as the theme picker. Hiding is a switch, not a delete: every control keeps
// its slot and comes back in place.

const LABELS: Record<HudItem, { title: string; hint: string }> = {
  brand: { title: "opendeath mark", hint: "The logo and wordmark at the start of the strip." },
  connection: { title: "Connection modes", hint: "Auto, None, and the rest in advanced mode." },
  fix: { title: "Fix connection", hint: "Tests what works here and puts the best route in place." },
  status: { title: "Status", hint: "Opens the connection panel." },
  help: { title: "Help", hint: "Shows the current error and the fixes that apply to it." },
  resetLimit: { title: "Reset limit", hint: "Archives the session and renews the IP." },
  rotateNow: { title: "New IP now", hint: "Rotates the exit IP without touching the session." },
  jailbreak: { title: "Jailbreak", hint: "Sends prompts through the hidden agent." },
  autoRotate: { title: "Auto-rotate", hint: "Rotates automatically when a limit or a drop shows up." },
  settings: { title: "Settings", hint: "Opens this window." },
  spacer: { title: "Push to the right", hint: "Empty space; everything after it sits at the far end." },
  readout: { title: "Route readout", hint: "Mode, exit IP and the last thing that happened." },
}

const row =
  "flex items-center gap-2 rounded-lg border border-v2-border-border-muted bg-v2-background-bg-layer-01 px-2 py-1.5"
const nudge =
  "grid size-6 shrink-0 place-items-center rounded-md text-v2-icon-icon-muted hover:bg-v2-overlay-simple-overlay-hover disabled:opacity-30"

export function HudEditor() {
  const [dragging, setDragging] = createSignal<HudItem>()
  const order = () => hudLayout().order

  const drop = (target: HudItem) => {
    const item = dragging()
    setDragging(undefined)
    if (!item || item === target) return
    moveItem(item, order().indexOf(target))
  }

  return (
    <div class="flex flex-col gap-3">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <p class="text-12-regular text-v2-text-text-muted">
          Drag a row, or use the arrows. Changes apply to the strip immediately.
        </p>
        <button
          type="button"
          class="rounded-lg px-2.5 py-1 text-12-regular text-v2-text-text-muted hover:bg-v2-overlay-simple-overlay-hover"
          onClick={() => resetHud()}
        >
          Reset layout
        </button>
      </div>
      <ul class="flex flex-col gap-1.5" aria-label="HUD order">
        <For each={order()}>
          {(item, index) => (
            <li
              class={row}
              classList={{
                "opacity-40": isHidden(item),
                "border-v2-border-border-base bg-v2-background-bg-accent/10": dragging() === item,
              }}
              draggable={true}
              onDragStart={(event) => {
                setDragging(item)
                event.dataTransfer?.setData("text/plain", item)
                if (event.dataTransfer) event.dataTransfer.effectAllowed = "move"
              }}
              onDragEnd={() => setDragging(undefined)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault()
                drop(item)
              }}
            >
              <span class="cursor-grab select-none pe-0.5 text-v2-icon-icon-faint" aria-hidden="true">
                ⠿
              </span>
              <div class="flex min-w-0 flex-1 flex-col">
                <span class="text-12-medium text-v2-text-text-base">{LABELS[item].title}</span>
                <span class="truncate text-[11px] text-v2-text-text-faint">{LABELS[item].hint}</span>
              </div>
              <button
                type="button"
                class={nudge}
                aria-label={`Move ${LABELS[item].title} up`}
                disabled={index() === 0}
                onClick={() => moveItem(item, index() - 1)}
              >
                ↑
              </button>
              <button
                type="button"
                class={nudge}
                aria-label={`Move ${LABELS[item].title} down`}
                disabled={index() === order().length - 1}
                onClick={() => moveItem(item, index() + 1)}
              >
                ↓
              </button>
              <button
                type="button"
                class="rounded-md px-2 py-1 text-[11px] uppercase tracking-[0.12em] text-v2-text-text-faint hover:bg-v2-overlay-simple-overlay-hover"
                aria-pressed={!isHidden(item)}
                onClick={() => setHidden(item, !isHidden(item))}
              >
                {isHidden(item) ? "Show" : "Hide"}
              </button>
            </li>
          )}
        </For>
      </ul>
    </div>
  )
}
