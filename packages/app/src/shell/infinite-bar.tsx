import { createEffect, createSignal, For, onCleanup, onMount, Show, type JSX } from "solid-js"
import { createStore } from "solid-js/store"
import { useGlobal } from "@/runtime/server/runtime"
import { ServerConnection } from "@/runtime/server/registry"
import { persisted } from "@/runtime/persistence/storage"
import { requestHistorySchema } from "./request-diagnostics"
import { requestDiagnostics, type RequestDiagnostic } from "./request-diagnostics"
import { useDialog } from "@opencode/ui/context/dialog"
import { usePlatform } from "@/runtime/platform/platform"
import {
  advancedMode,
  autoRotate as auto,
  jailbreak,
  setAutoRotate as setAuto,
  setJailbreak,
} from "@/shell/infinite-state"
import { initLook } from "@/shell/infinite-look"
import { deckDensity } from "@/shell/ui-prefs"
import { SettingsDialog } from "@/shell/settings-dialog"
import { addHistory } from "@/shell/infinite-history"
import { ConnectionDialog } from "@/shell/connection-dialog"
import { HelpDialog } from "@/shell/help-dialog"
import { fixConnection } from "@/shell/infinite-doctor"
import {
  HUD_ITEMS,
  hudEditing,
  hudLayout,
  isHidden,
  moveItem,
  resetHud,
  setHidden,
  setHudEditing,
  visibleItems,
  type HudItem,
} from "@/shell/hud-layout"

type Mode = "WARP" | "PROXY" | "SOCKS" | "ROUTE64" | "MULLVAD" | "WINDSCRIBE" | "NONE"
// Auto is not a mode of its own: it picks WARP when it works, then the free proxy list, then None.
type Choice = Mode | "AUTO"
type Result = { ok: boolean; message: string; ip?: string }

const modes: { id: Choice; label: string; title: string }[] = [
  { id: "WARP", label: "WARP", title: "Cloudflare WARP proxy. The default route. Asks before installing WARP." },
  {
    id: "AUTO",
    label: "Auto",
    title: "WARP when it works, then the free proxy list, so the IP can still change. Installs nothing.",
  },
  { id: "PROXY", label: "Proxy", title: "Your proxy list, or the free list when it is empty." },
  {
    id: "SOCKS",
    label: "SOCKS5",
    title: "Your SOCKS5 servers, reached through a local bridge. Needs a list in Settings.",
  },
  {
    id: "ROUTE64",
    label: "Route64",
    title: "route64 WireGuard tunnel. Needs your .conf and administrator permission.",
  },
  { id: "MULLVAD", label: "Mullvad", title: "Mullvad app: switches server. Needs Mullvad installed and logged in." },
  {
    id: "WINDSCRIBE",
    label: "Windscribe",
    title: "Windscribe app: switches server. Needs Windscribe installed and logged in.",
  },
  { id: "NONE", label: "None", title: "Direct connection, no proxy." },
]

// WARP is the default route, so it always shows. Without advanced mode Auto and None show beside it; the rest sit
// behind Settings, Advanced mode.
const visibleModes = () =>
  modes.filter((item) => advancedMode() || item.id === "WARP" || item.id === "AUTO" || item.id === "NONE")

const button =
  "px-2.5 py-1 rounded-md text-v2-text-text-base bg-v2-background-bg-layer-02 hover:bg-v2-overlay-simple-overlay-hover disabled:opacity-50 disabled:pointer-events-none"

const names: Record<string, string> = {
  AUTO: "Auto",
  WARP: "WARP",
  PROXY: "Proxy",
  SOCKS: "SOCKS5",
  ROUTE64: "Route64",
  MULLVAD: "Mullvad",
  WINDSCRIBE: "Windscribe",
  NONE: "None",
}
const modeLabel = (mode: string) => names[mode] ?? mode

// Spoken names for the edit strip, so a drag row says what it moves.
const ITEM_NAMES: Record<HudItem, string> = {
  brand: "opendeath mark",
  connection: "Connection modes",
  fix: "Fix connection",
  status: "Status",
  help: "Help",
  resetLimit: "Reset limit",
  rotateNow: "New IP now",
  jailbreak: "Jailbreak",
  autoRotate: "Auto-rotate",
  settings: "Settings",
  spacer: "Push to the right",
  readout: "Route readout",
}

// First-run marker: kept in this app's local storage, like the other per-computer preferences.
const SETUP_KEY = "opencode.infinite.setup"
const readFlag = (key: string) => {
  try {
    return localStorage.getItem(key)
  } catch {
    return "1"
  }
}
const writeFlag = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Without storage the setup would repeat; readFlag answers "done" then, so it never loops.
  }
}

// opendeath command deck: the Infinite controls, moved from the bottom edge to a branded strip under the titlebar.
// The strip renders from the HUD layout store, so every control keeps its own slot and order.
export function InfiniteBar() {
  const platform = usePlatform()
  const global = useGlobal()
  const [diagnostics, setDiagnostics] = createStore<{ rows: RequestDiagnostic[] }>({ rows: [] })
  const [history, setHistory, , historyReady] = persisted(
    { key: "opendeath.request-history.v1" },
    requestHistorySchema,
    { rows: [] },
  )
  const requests = () =>
    [
      ...diagnostics.rows,
      ...history.rows
        .filter(
          (row) =>
            !diagnostics.rows.some((live) => live.sessionID === row.sessionID && live.serverKey === row.serverKey),
        )
        .map((row) => ({ ...row, saved: true })),
    ].slice(0, 8)
  createEffect(() => {
    if (!historyReady()) return
    global.servers.list().forEach((server) => {
      const sdk = global.serverCtx(ServerConnection.key(server))?.sdk
      if (!sdk) return
      onCleanup(
        sdk.event.listen((event) => {
          if (
            event.type !== "session.step.started" &&
            event.type !== "session.retry.scheduled" &&
            event.type !== "session.step.failed" &&
            event.type !== "session.step.ended"
          )
            return
          const base = {
            id: event.id,
            serverKey: ServerConnection.key(server),
            sessionID: event.data.sessionID,
            messageID: event.data.assistantMessageID,
            at: event.created,
          }
          const update =
            event.type === "session.step.started"
              ? { ...base, type: "started" as const, model: event.data.model.id, provider: event.data.model.providerID }
              : event.type === "session.step.ended"
                ? { ...base, type: "completed" as const }
                : {
                    ...base,
                    error: `${event.data.error.type}: ${event.data.error.message}`,
                    resetAt:
                      event.data.error.retryAfterMs === undefined
                        ? undefined
                        : event.created + event.data.error.retryAfterMs,
                    ...(event.type === "session.retry.scheduled"
                      ? { type: "retrying" as const, attempt: event.data.attempt, retryAt: event.data.at }
                      : { type: "failed" as const }),
                  }
          setDiagnostics("rows", (rows) => requestDiagnostics(rows, update))
          setHistory("rows", (rows) => requestDiagnostics([...rows], update))
        }),
      )
    })
  })
  const dialog = useDialog()
  const infinite = platform.infinite
  const [mode, setMode] = createSignal<Mode>("NONE")
  const [selected, setSelected] = createSignal<Choice>("NONE")
  const [busy, setBusy] = createSignal(false)
  const [result, setResult] = createSignal<Result | undefined>()
  const [dragging, setDragging] = createSignal<HudItem>()

  onMount(() => {
    initLook()
    void infinite?.getMode().then((current) => {
      setMode(current)
      setSelected(current)
    })
    void infinite?.getOptions().then((options) => setAuto(options.auto))
    void infinite?.checkIp().then(setResult)
    // The doctor (panel, first run or watchdog) changed the connection: show the new mode and IP.
    const refresh = () => {
      void infinite?.getMode().then((current) => {
        setMode(current)
        setSelected(current)
      })
      void infinite?.checkIp().then(setResult)
    }
    window.addEventListener("infinite-connection", refresh)
    // First run: set the connection up on its own and show what was found. Never again after that.
    if (infinite && readFlag(SETUP_KEY) !== "1") {
      writeFlag(SETUP_KEY, "1")
      dialog.show(() => <ConnectionDialog autostart />)
    }
    // Keeps the dot honest between clicks, and heals a dead connection: a mode other than Direct whose proxy stopped
    // answering is repaired (at most every two minutes), so the chats keep working without anyone clicking.
    let lastHeal = 0
    const timer = setInterval(() => {
      if (busy()) return
      void infinite?.checkIp().then((checked) => {
        if (busy()) return
        setResult(checked)
        if (checked.ok || mode() === "NONE" || Date.now() - lastHeal < 120_000) return
        lastHeal = Date.now()
        void run("Connection lost, fixing it…", async () => {
          const outcome = await fixConnection(infinite!, (message) => setResult({ ok: true, message }))
          setMode(outcome.mode)
          setSelected(outcome.mode)
          return { ok: outcome.ok, message: outcome.message, ip: outcome.ip }
        })
      })
    }, 20_000)
    onCleanup(() => {
      clearInterval(timer)
      window.removeEventListener("infinite-connection", refresh)
    })
  })

  const saveOptions = (next: boolean) => {
    setAuto(next)
    void infinite?.getOptions().then((options) => infinite.setOptions({ ...options, auto: next }))
  }

  // Every action is single-flight, and the service restart behind it can take a while.
  const run = async (label: string, work: () => Promise<Result>) => {
    if (busy()) return
    setBusy(true)
    setResult({ ok: true, message: label })
    try {
      setResult(await work())
    } catch (error) {
      setResult({ ok: false, message: error instanceof Error ? error.message : String(error) })
    } finally {
      setBusy(false)
    }
  }

  // Switches the connection and remembers it in the history. The mode only changes when the switch worked.
  const apply = (next: Mode, label: string) =>
    run(`Switching to ${label}…`, async () => {
      const applied = await infinite!.setMode(next)
      addHistory({ mode: next, ok: applied.ok, ip: applied.ip })
      if (applied.ok) setMode(next)
      else {
        // A failed switch leaves the main process on a mode that still answers (direct, usually). Follow it, so the
        // deck never shows a route the app is not on.
        const current = await infinite!.getMode()
        setMode(current)
        setSelected(current)
      }
      return applied
    })

  // A missing client is installed only after the user says yes; installing needs administrator rights.
  const ensureInstalled = async (tool: "WARP" | "WIREGUARD", name: string): Promise<boolean> => {
    const plan = await infinite!.toolPlan(tool)
    if (plan.installed) return true
    const yes = window.confirm(
      `${name} is not installed.\n\nInstall it now from ${plan.url} (signed by ${plan.publisher})? Windows will ask for administrator permission.`,
    )
    if (!yes) {
      setResult({ ok: false, message: `Cancelled: ${name} was not installed.` })
      return false
    }
    setResult({ ok: true, message: `Installing ${name}…` })
    const installed = await infinite!.toolInstall(tool, true)
    setResult(installed)
    return installed.ok
  }

  // Auto: WARP if it connects, else the free proxy list (which can still rotate), else direct.
  // It never installs WARP, and it never stops at "None" while a rotation is still possible.
  const autoConnect = async () => {
    if (busy()) return
    setSelected("AUTO")
    const warp = await infinite!.toolPlan("WARP")
    if (warp.installed) {
      setBusy(true)
      setResult({ ok: true, message: "Auto: trying WARP…" })
      try {
        const applied = await infinite!.setMode("WARP")
        addHistory({ mode: "WARP", ok: applied.ok, ip: applied.ip })
        if (applied.ok) {
          setMode("WARP")
          return setResult({ ok: true, message: `Auto: WARP. ${applied.message}`, ip: applied.ip })
        }
      } catch (error) {
        setResult({ ok: false, message: error instanceof Error ? error.message : String(error) })
      } finally {
        setBusy(false)
      }
    }
    setResult({ ok: true, message: "Auto: WARP is not usable, trying the free proxy list…" })
    await apply("PROXY", "Proxy (Auto fallback)")
    // apply() reports a failed switch through result; only fall back to Direct when it really failed.
    if (mode() !== "PROXY") await apply("NONE", "None (no proxy answered)")
  }

  const pick = async (item: { id: Choice; label: string }) => {
    if (busy() || hudEditing()) return
    try {
      if (item.id === "AUTO") return await autoConnect()
      if (item.id === "WARP" && !(await ensureInstalled("WARP", "WARP"))) return
      if (item.id === "ROUTE64") {
        if (!(await ensureInstalled("WIREGUARD", "WireGuard"))) return
        // Without a config the tunnel cannot start; say so here instead of failing inside the service.
        if (!(await infinite!.route64Status()).imported)
          return setResult({ ok: false, message: "No route64 config yet: import the .conf in Settings, Advanced." })
      }
      setSelected(item.id)
      await apply(item.id as Mode, item.label)
    } catch (error) {
      setResult({ ok: false, message: error instanceof Error ? error.message : String(error) })
    }
  }

  // "New IP now": rotates the exit IP only. It is the manual half of Auto-rotate and works with the
  // checkbox off, because the click itself is the instruction.
  const rotateNow = () =>
    run("Changing the IP…", async () => {
      await infinite!.autoRotate("")
      return (await infinite!.checkIp()) as Result
    })

  const state = () => {
    const current = result()
    if (busy()) return "busy"
    if (!current) return "idle"
    return current.ok ? "ok" : "bad"
  }

  // Every slot the strip can hold. Reading the layout only decides the order; the slot decides the pixels.
  const slots: Record<HudItem, () => JSX.Element> = {
    brand: () => (
      <span class="flex items-center gap-2 pe-1 select-none" title="opendeath">
        <img src="/opendeath-mark.png" alt="" aria-hidden="true" class="size-5 rounded-[4px]" />
        <span class="text-13-medium tracking-tight text-v2-text-text-base">opendeath</span>
      </span>
    ),
    connection: () => (
      <div
        class="flex flex-wrap items-center gap-1 p-0.5 rounded-lg bg-v2-background-bg-layer-02"
        role="radiogroup"
        aria-label="Connection"
      >
        <For each={visibleModes()}>
          {(item) => (
            <button
              type="button"
              role="radio"
              title={item.title}
              aria-checked={selected() === item.id}
              disabled={busy() || hudEditing()}
              class="px-2.5 py-0.5 rounded-md disabled:pointer-events-none"
              classList={{
                "bg-v2-background-bg-accent/20 text-v2-text-text-accent": selected() === item.id,
                "hover:bg-v2-overlay-simple-overlay-hover": selected() !== item.id,
              }}
              onClick={() => void pick(item)}
            >
              {item.label}
            </button>
          )}
        </For>
      </div>
    ),
    fix: () => (
      <button
        type="button"
        class={button}
        disabled={busy() || hudEditing()}
        title="Tests what works on this computer and puts the best connection in place."
        onClick={() =>
          void run("Fixing the connection…", async () => {
            const outcome = await fixConnection(infinite!, (message) => setResult({ ok: true, message }), true)
            setMode(outcome.mode)
            setSelected(outcome.mode)
            return { ok: outcome.ok, message: outcome.message, ip: outcome.ip }
          })
        }
      >
        Fix connection
      </button>
    ),
    status: () => (
      <button
        type="button"
        class={button}
        disabled={hudEditing()}
        title="What works on this computer."
        onClick={() => void dialog.show(() => <ConnectionDialog />)}
      >
        Status
      </button>
    ),
    help: () => (
      <button
        type="button"
        class={button}
        disabled={hudEditing()}
        title="What is failing right now, and the fixes that apply to it."
        onClick={() =>
          void dialog.show(() => (
            <HelpDialog
              message={result()?.ok === false ? result()?.message : undefined}
              requests={requests()}
              onClear={() => {
                setDiagnostics("rows", [])
                setHistory("rows", [])
              }}
            />
          ))
        }
      >
        Help
      </button>
    ),
    resetLimit: () => (
      <button
        type="button"
        class={button}
        disabled={busy() || hudEditing()}
        title="Archives the session and renews the IP."
        onClick={() => void run("Resetting limit…", () => infinite!.resetLimit())}
      >
        Reset limit
      </button>
    ),
    rotateNow: () => (
      <button
        type="button"
        class={button}
        disabled={busy() || hudEditing()}
        title="Changes the exit IP now, without archiving the session."
        onClick={() => void rotateNow()}
      >
        New IP
      </button>
    ),
    jailbreak: () => (
      <label
        class="flex items-center gap-1.5"
        title="Sends every prompt through the hidden OPEN.DEATH agent, so the guide is the system prompt and never shows up in the chat."
      >
        <input
          type="checkbox"
          checked={jailbreak()}
          disabled={hudEditing()}
          onChange={(event) => setJailbreak(event.currentTarget.checked)}
        />
        Jailbreak
      </label>
    ),
    autoRotate: () => (
      <label
        class="flex items-center gap-1.5"
        title="Rotates the IP when a limit error shows up or the connection drops. Keeps your session."
      >
        <input
          type="checkbox"
          checked={auto()}
          disabled={hudEditing()}
          onChange={(event) => saveOptions(event.currentTarget.checked)}
        />
        Auto-rotate
      </label>
    ),
    settings: () => (
      <button
        type="button"
        class={button}
        disabled={hudEditing()}
        onClick={() => void dialog.show(() => <SettingsDialog />)}
      >
        Settings
      </button>
    ),
    spacer: () => <span class="min-w-2 flex-1" aria-hidden="true" />,
    readout: () => (
      <span class="flex min-w-0 items-center gap-2" role="status" aria-live="polite">
        <span
          class="size-2 shrink-0 rounded-full"
          classList={{
            "bg-v2-state-fg-warning animate-pulse": state() === "busy",
            "bg-v2-state-fg-danger": state() === "bad",
            "bg-[#50a27a]": state() === "ok",
            "bg-v2-icon-icon-faint": state() === "idle",
          }}
        />
        <span class="shrink-0 rounded-full border border-v2-border-border-muted px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-v2-text-text-muted">
          {modeLabel(mode())}
        </span>
        <Show when={result()?.ip}>
          {(ip) => (
            <span class="shrink-0 rounded-full bg-v2-background-bg-layer-02 px-2 py-0.5 font-mono text-[10px] text-v2-text-text-muted">
              {ip()}
            </span>
          )}
        </Show>
        <span class="truncate text-v2-text-text-faint">{result()?.message}</span>
      </span>
    ),
  }

  const drop = (target: HudItem) => {
    const item = dragging()
    setDragging(undefined)
    if (!item || item === target) return
    moveItem(item, visibleItems().indexOf(target), true)
  }

  return (
    <Show when={infinite}>
      <div
        data-slot="infinite-bar"
        class="shrink-0 flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 text-12-regular bg-v2-background-bg-deep border-b border-v2-border-border-muted text-v2-text-text-muted"
        classList={{ "py-1": deckDensity() === "compact", "py-2": deckDensity() !== "compact" }}
      >
        <Show when={hudEditing()} fallback={<For each={visibleItems()}>{(item) => slots[item]()}</For>}>
          <div class="flex w-full flex-wrap items-center gap-1.5">
            <span class="pe-1 text-[10px] uppercase tracking-[0.22em] text-v2-text-text-faint">HUD editor</span>
            <For each={hudLayout().order}>
              {(item) => (
                <button
                  type="button"
                  draggable={true}
                  aria-pressed={!isHidden(item)}
                  title={`${ITEM_NAMES[item]} — drag to move, click to hide or show`}
                  class="cursor-grab rounded-md border px-2 py-0.5 text-12-regular active:cursor-grabbing"
                  classList={{
                    "border-v2-border-border-base bg-v2-background-bg-accent/15 text-v2-text-text-accent":
                      dragging() === item,
                    "border-v2-border-border-muted bg-v2-background-bg-layer-02 text-v2-text-text-base":
                      dragging() !== item && !isHidden(item),
                    "border-dashed border-v2-border-border-muted text-v2-text-text-faint line-through": isHidden(item),
                  }}
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
                  onClick={() => setHidden(item, !isHidden(item))}
                >
                  {ITEM_NAMES[item]}
                </button>
              )}
            </For>
            <button
              type="button"
              class={button}
              title="Put every control back in its shipped place."
              onClick={() => resetHud()}
            >
              Reset
            </button>
            <button type="button" class={button} onClick={() => setHudEditing(false)}>
              Done
            </button>
            <span class="text-[11px] text-v2-text-text-faint">
              {HUD_ITEMS.length - hudLayout().hidden.length} of {HUD_ITEMS.length} shown
            </span>
          </div>
        </Show>
      </div>
    </Show>
  )
}
