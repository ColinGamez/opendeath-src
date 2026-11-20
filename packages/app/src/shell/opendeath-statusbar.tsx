import { createSignal, onCleanup, onMount, Show } from "solid-js"
import { usePlatform } from "@/runtime/platform/platform"
import { autoRotate, setAutoRotate } from "@/shell/infinite-state"
import { hudEditing, setHudEditing } from "@/shell/hud-layout"

const labels: Record<string, string> = {
  AUTO: "Auto",
  WARP: "WARP",
  PROXY: "Proxy",
  SOCKS: "SOCKS5",
  ROUTE64: "Route64",
  MULLVAD: "Mullvad",
  WINDSCRIBE: "Windscribe",
  NONE: "Direct",
}

/**
 * opendeath: the band along the bottom edge.
 *
 * It used to be a brand line that repeated the deck. Now it is the always-visible answer to the two
 * questions the deck cannot always show — "what route am I on, and what IP does the internet see" —
 * plus the one control that must never be hideable: the HUD editor. Everything on it reads from the
 * same state the deck uses, so the two can never disagree.
 */
export function OpendeathStatusbar() {
  const platform = usePlatform()
  const infinite = platform.infinite
  const [mode, setMode] = createSignal("NONE")
  const [ip, setIp] = createSignal<string>()
  const [online, setOnline] = createSignal<boolean>()

  onMount(() => {
    let alive = true
    const read = async () => {
      if (!infinite) return
      const current = await infinite.getMode()
      const checked = await infinite.checkIp()
      if (!alive) return
      setMode(current)
      setIp(checked.ip)
      setOnline(checked.ok)
    }
    void read()
    const refresh = () => void read()
    window.addEventListener("infinite-connection", refresh)
    // The IP is the thing that changes under a rotation, so it is polled while the deck is idle too.
    const timer = setInterval(refresh, 20_000)
    onCleanup(() => {
      alive = false
      clearInterval(timer)
      window.removeEventListener("infinite-connection", refresh)
    })
  })

  return (
    <Show when={infinite}>
      <div
        data-slot="opendeath-statusbar"
        class="shrink-0 flex h-7 items-center gap-2.5 px-3 text-[11px] text-v2-text-text-faint bg-v2-background-bg-deep border-t border-v2-border-border-muted select-none"
      >
        <img src="/opendeath-mark.png" alt="" aria-hidden="true" class="size-3.5 rounded-[3px] opacity-80" />
        <span class="font-medium tracking-wide text-v2-text-text-muted">opendeath</span>
        <Show when={platform.version}>
          {(value) => (
            <span class="rounded-[4px] border border-v2-border-border-muted px-1.5 py-px font-mono text-[10px] text-v2-text-text-faint">
              v{value()}
            </span>
          )}
        </Show>

        <span aria-hidden="true" class="h-3.5 w-px bg-v2-border-border-muted" />

        <span class="flex items-center gap-1.5" role="status" aria-live="polite">
          <span
            class="size-1.5 rounded-full"
            classList={{
              "bg-[#50a27a]": online() === true,
              "bg-v2-state-fg-danger": online() === false,
              "bg-v2-icon-icon-faint": online() === undefined,
            }}
            title={online() === true ? "The route answers" : online() === false ? "The route is not answering" : "Checking"}
          />
          <span class="text-v2-text-text-muted">{labels[mode()] ?? mode()}</span>
        </span>

        <Show when={ip()}>
          {(value) => (
            <span class="rounded-[4px] bg-v2-background-bg-layer-02 px-1.5 py-px font-mono text-[10px] text-v2-text-text-muted">
              {value()}
            </span>
          )}
        </Show>

        <button
          type="button"
          class="rounded-[4px] px-1.5 py-px uppercase tracking-[0.12em] text-[10px] text-v2-text-text-faint hover:bg-v2-overlay-simple-overlay-hover"
          aria-pressed={autoRotate()}
          title="Auto-rotate: changes the IP when a free limit shows up or the connection drops."
          onClick={() => {
            const next = !autoRotate()
            setAutoRotate(next)
            void infinite!
              .getOptions()
              .then((options) => infinite!.setOptions({ ...options, auto: next }))
          }}
        >
          auto-rotate {autoRotate() ? "on" : "off"}
        </button>

        <span class="ms-auto flex items-center gap-2">
          <button
            type="button"
            class="rounded-[4px] px-2 py-px text-[10px] uppercase tracking-[0.12em] text-v2-text-text-faint hover:bg-v2-overlay-simple-overlay-hover"
            aria-pressed={hudEditing()}
            title="Move the deck's buttons: drag to reorder, click to hide or show."
            onClick={() => setHudEditing(!hudEditing())}
          >
            {hudEditing() ? "close HUD editor" : "edit HUD"}
          </button>
          <span class="opacity-50">Infinite network engine</span>
        </span>
      </div>
    </Show>
  )
}
