import { WorkbenchSection } from "./workbench-section"
import { BackgroundSection } from "./background-section"
import { createEffect, createMemo, createSignal, For, Match, onMount, Show, Switch, type JSX } from "solid-js"
import { Dialog, DialogBody, DialogHeader, DialogTitleGroup } from "@opencode/ui/dialog"
import { Icon } from "@opencode/ui/icon"
import { useTheme, type ColorScheme } from "@opencode/ui/theme/context"
import { usePlatform } from "@/runtime/platform/platform"
import { clearBackground, getAccent, getDialogOpacity, getRadius, getRainbow, getTextColor, setAccent, setDialogOpacity, setRadius, setRainbow, setTextColor, type RainbowTarget } from "@/shell/infinite-look"
import { deckDensity, setDeckDensity, setStatusBand, statusBand } from "@/shell/ui-prefs"
import { HudEditor } from "@/shell/hud-editor"
import { hudEditing, hudSummary, setHudEditing } from "@/shell/hud-layout"
import { createAppearanceSettingsController } from "@/settings/general/controllers"
import { readHistory } from "@/shell/infinite-history"
import { advancedMode, dictation, setAdvancedMode, setDictation } from "@/shell/infinite-state"

type Tab = "basic" | "advanced" | "personalization" | "hud"

const tabs: { id: Tab; label: string; hint: string; icon: string; title: string; description: string }[] = [
  {
    id: "basic",
    label: "Connection",
    hint: "Route & recovery",
    icon: "outline-sliders",
    title: "Connection & recovery",
    description: "How opendeath finds a fresh IP, continues a waiting chat, and what it remembers on this computer.",
  },
  {
    id: "personalization",
    label: "Personalization",
    hint: "Colour, shape, motion",
    icon: "outline-photo",
    title: "Look & feel",
    description: "Themes, accent, corners, text, background picture, fonts, size and motion. Everything applies as you change it.",
  },
  {
    id: "hud",
    label: "HUD",
    hint: "Where the buttons live",
    icon: "outline-steer",
    title: "HUD editor",
    description: "Every control in the deck, in the order that suits this machine. Drag a row or use the arrows; hiding keeps the slot.",
  },
  {
    id: "advanced",
    label: "Advanced",
    hint: "Proxies & tunnels",
    icon: "settings-gear",
    title: "Proxies & tunnels",
    description: "Proxy pools, SOCKS5 servers, failover, route64 and VPN locations — the controls behind the deck's modes.",
  },
]
const schemes: ColorScheme[] = ["system", "light", "dark"]

const chip = (active: boolean) =>
  `px-4 py-2 rounded-xl text-13-regular transition-colors disabled:opacity-50 ${
    active
      ? "bg-[#a32433] text-white hover:bg-[#b62a3b]"
      : "bg-v2-background-bg-layer-02 text-v2-text-text-muted hover:bg-v2-overlay-simple-overlay-hover"
  }`

const field =
  "w-full px-3.5 py-2.5 rounded-xl text-13-regular bg-v2-background-bg-layer-02 text-v2-text-text-base border border-v2-border-border-muted focus:outline-none focus:border-[#b23a49] focus:ring-2 focus:ring-[#b23a49]/20"

// A bordered group with a title and one line saying what it does. Every tab uses it, so the dialog reads the same everywhere.
function Card(props: { title: string; hint?: string; icon?: string; tone?: "default" | "accent"; class?: string; children: JSX.Element }) {
  return (
    <section
      class={`relative flex flex-col gap-4 overflow-hidden rounded-2xl border p-5 ${
        props.tone === "accent"
          ? "border-[color:rgba(185,44,58,0.34)] bg-[linear-gradient(140deg,rgba(86,18,27,0.18),rgba(18,12,13,0.55))]"
          : "border-v2-border-border-muted bg-v2-background-bg-layer-01"
      } ${props.class ?? ""}`}
    >
      <span
        aria-hidden="true"
        class="pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-v2-text-text-accent/40 to-transparent"
      />
      <div class="flex items-start gap-3">
        <Show when={props.icon}>
          {(icon) => (
            <span class="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg border border-v2-border-border-muted bg-v2-background-bg-layer-02 text-v2-text-text-accent">
              <Icon name={icon()} size="small" />
            </span>
          )}
        </Show>
        <div class="flex min-w-0 flex-col gap-1">
          <h3 class="text-13-medium text-v2-text-text-base">{props.title}</h3>
          <Show when={props.hint}>
            <p class="text-12-regular leading-[1.55] text-v2-text-text-muted">{props.hint}</p>
          </Show>
        </div>
      </div>
      {props.children}
    </section>
  )
}

// Basic: what most people need. Advanced: proxies and the route64 tunnel. Themes: colors, mode and the background picture.
export function SettingsDialog() {
  const platform = usePlatform()
  const [tab, setTab] = createSignal<Tab>("basic")
  let content: HTMLDivElement | undefined
  // Each section starts at its own top; a scroll position from the previous tab makes no sense here.
  createEffect(() => {
    tab()
    content?.scrollTo({ top: 0 })
  })
  // The Advanced tab only exists in advanced mode; turning the mode off from it goes back to Basic.
  const visibleTabs = () => tabs.filter((item) => item.id !== "advanced" || advancedMode())
  const active = createMemo(() => visibleTabs().find((item) => item.id === tab()) ?? visibleTabs()[0]!)
  const position = createMemo(() => Math.max(1, visibleTabs().findIndex((item) => item.id === active().id) + 1))
  const total = createMemo(() => visibleTabs().length)
  const toggleAdvanced = () => {
    if (advancedMode()) {
      setTab("basic")
      setAdvancedMode(false)
    } else setAdvancedMode(true)
  }
  return (
    <Dialog size="x-large" containerClass="infinite-settings opendeath-settings">
      <DialogHeader>
        <div class="flex min-w-0 flex-1 items-start gap-3">
          <img src="/opendeath-mark.png" alt="" aria-hidden="true" class="mt-0.5 size-9 shrink-0 rounded-lg" />
          <div class="flex min-w-0 flex-col gap-1">
            <span class="text-[10px] font-[600] uppercase tracking-[0.28em] text-v2-text-text-faint">opendeath</span>
            <DialogTitleGroup title="Settings" description="Network, recovery and appearance. Everything saves as you go." />
          </div>
        </div>
      </DialogHeader>
      <DialogBody class="min-h-0">
        <div class="flex min-h-0 w-full flex-1">
          <aside class="flex w-[204px] shrink-0 flex-col border-e border-v2-border-border-muted bg-v2-background-bg-deep p-3">
            <div class="px-2 pt-1 pb-3">
              <p class="text-[10px] font-[600] uppercase tracking-[0.26em] text-v2-text-text-faint">Control room</p>
            </div>
            <nav role="tablist" aria-label="Settings sections" class="flex flex-col gap-1">
              <For each={visibleTabs()}>
                {(item) => (
                  <button
                    type="button"
                    role="tab"
                    aria-selected={tab() === item.id}
                    class="group relative flex w-full items-start gap-2.5 rounded-xl px-3 py-2.5 text-start transition-colors"
                    classList={{
                      "bg-v2-background-bg-layer-02": tab() === item.id,
                      "hover:bg-v2-overlay-simple-overlay-hover/60": tab() !== item.id,
                    }}
                    onClick={() => setTab(item.id)}
                  >
                    <span
                      class="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg border transition-colors"
                      classList={{
                        "border-v2-border-border-base bg-v2-background-bg-accent/15 text-v2-text-text-accent": tab() === item.id,
                        "border-v2-border-border-muted bg-v2-background-bg-layer-01 text-v2-icon-icon-muted": tab() !== item.id,
                      }}
                    >
                      <Icon name={item.icon} size="small" />
                    </span>
                    <span class="flex min-w-0 flex-col gap-0.5">
                      <span class="text-13-medium text-v2-text-text-base">{item.label}</span>
                      <span class="text-[11px] leading-[1.4] text-v2-text-text-faint">{item.hint}</span>
                    </span>
                    <Show when={tab() === item.id}>
                      <span class="absolute inset-y-2 start-0 w-0.5 rounded-full bg-v2-text-text-accent" />
                    </Show>
                  </button>
                )}
              </For>
            </nav>
            <div class="mt-auto flex flex-col gap-3 rounded-xl border border-v2-border-border-muted bg-v2-background-bg-layer-01 p-3">
              <div class="flex items-center gap-2">
                <span class="size-1.5 rounded-full bg-[#d2404c]" />
                <span class="text-12-medium text-v2-text-text-base">Infinite engine</span>
              </div>
              <p class="text-[11px] leading-[1.5] text-v2-text-text-faint">Network and appearance stay local to this computer.</p>
              <button
                type="button"
                class="flex items-center justify-between rounded-lg border border-v2-border-border-muted bg-v2-background-bg-layer-02 px-2.5 py-1.5 text-[11px] text-v2-text-text-muted hover:bg-v2-overlay-simple-overlay-hover"
                aria-pressed={hudEditing()}
                onClick={() => setHudEditing(!hudEditing())}
              >
                <span>HUD editor</span>
                <span class="text-v2-text-text-faint">{hudEditing() ? "on" : hudSummary()}</span>
              </button>
              <div class="flex items-center justify-between border-t border-v2-border-border-muted pt-2 text-[10px] uppercase tracking-[0.18em] text-v2-text-text-faint">
                <span>opendeath</span>
                <span>{platform.version ? `v${platform.version}` : "desktop"}</span>
              </div>
            </div>
          </aside>
          <div class="flex min-w-0 flex-1 flex-col">
            <div class="flex flex-wrap items-end justify-between gap-3 border-b border-v2-border-border-muted px-6 py-5">
              <div class="min-w-0">
                <p class="text-[10px] font-[600] uppercase tracking-[0.3em] text-v2-text-text-accent">
                  {String(position()).padStart(2, "0")} / {String(total()).padStart(2, "0")}
                </p>
                <h2 class="mt-2 text-[21px] font-[560] tracking-[-0.03em] text-v2-text-text-base">{active().title}</h2>
                <p class="mt-1 max-w-[560px] text-12-regular leading-[1.55] text-v2-text-text-muted">{active().description}</p>
              </div>
              <span class="hidden shrink-0 items-center gap-1.5 rounded-full border border-v2-border-border-muted bg-v2-background-bg-layer-02 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-v2-text-text-faint sm:flex">
                <span class="size-1 rounded-full bg-[#50a27a]" /> auto-saved
              </span>
            </div>
            <div ref={content} class="min-h-0 flex-1 overflow-y-auto px-6 py-5">
              <Switch>
                <Match when={tab() === "basic"}>
                  <div class="grid grid-cols-1 items-start gap-4 min-[920px]:grid-cols-2">
                    <Card
                      icon="outline-sliders"
                      class="min-[920px]:col-span-2"
                      title="Advanced mode"
                      hint="Off: WARP, Auto and None show. On: every connection (Proxy, SOCKS5, Route64, Mullvad, Windscribe) and the Advanced tab."
                    >
                      <div>
                        <button type="button" class={chip(advancedMode())} onClick={toggleAdvanced}>
                          {advancedMode() ? "Hide advanced options" : "Show all options"}
                        </button>
                      </div>
                    </Card>
                    <BasicSection />
                    <Show when={platform.infinite?.dictate}>
                      <Card
                        icon="outline-wave-audio"
                        class="min-[920px]:col-span-2"
                        title="Voice dictation"
                        hint="Adds a microphone next to Send. It opens Windows voice typing (Win+H) in the message box and sends the text when you stop talking. Typing a key yourself cancels the send."
                      >
                        <DictationSection />
                      </Card>
                    </Show>
                  </div>
                </Match>
                <Match when={tab() === "hud"}>
                  <div class="flex flex-col gap-4">
                    <Card
                      icon="outline-steer"
                      title="Deck controls"
                      hint="The strip under the titlebar. Drag to reorder, hide what you never use, and reset when a layout stops earning its keep. The band at the bottom of the window opens this editor any time, so no control can be lost."
                    >
                      <div class="flex flex-col gap-4">
                        <div class="flex flex-wrap items-center gap-2">
                          <button type="button" class={chip(hudEditing())} onClick={() => setHudEditing(!hudEditing())}>
                            {hudEditing() ? "Stop editing the deck" : "Edit the deck in place"}
                          </button>
                          <span class="text-12-regular text-v2-text-text-faint">{hudSummary()}</span>
                        </div>
                        <HudEditor />
                      </div>
                    </Card>
                  </div>
                </Match>
                <Match when={tab() === "advanced"}>
                  <div class="grid grid-cols-1 items-start gap-4 min-[920px]:grid-cols-2">
                    <Card
                      class="min-[920px]:col-span-2"
                      icon="outline-globe"
                      title="Proxies"
                      hint="One proxy or a whole list: host:port, host:port:user:password or http://user:password@host:port, separated by lines, spaces or commas. HTTP proxies only; SOCKS5 goes in its own box below. A rotating proxy goes in the list too. Empty means the free list. Used by the Proxy choice in the deck."
                    >
                      <div class="flex flex-col gap-6">
                        <ProxySection />
                        <ChangeIpSection />
                      </div>
                    </Card>
                    <Card
                      icon="lock"
                      title="SOCKS5 servers"
                      hint="What the SOCKS5 choice in the deck connects through: host:port, host:port:user:password, socks5://host:port or socks5://user:password@host:port, one per line. They are only reachable from this computer."
                    >
                      <SocksSection />
                    </Card>
                    <Card
                      icon="outline-steer"
                      title="Failover chain"
                      hint="Modes Auto-rotate falls back to, in order, when the chosen one cannot get a fresh IP, for example PROXY,SOCKS. Empty keeps it on the chosen mode."
                    >
                      <ChainSection />
                    </Card>
                    <Card
                      icon="outline-pair"
                      title="route64 tunnel"
                      hint="Import the .conf from manager.route64.org. Choose Route64 in the deck to connect."
                    >
                      <Route64Section />
                    </Card>
                    <Card
                      icon="outline-globe-plus"
                      title="VPN locations"
                      hint="Mullvad or Windscribe locations to switch between, separated by commas. Empty means the defaults."
                    >
                      <VpnLocationsSection />
                    </Card>
                  </div>
                </Match>
                <Match when={tab() === "personalization"}>
                  <div class="grid grid-cols-1 items-start gap-4 min-[920px]:grid-cols-2">
                    <Card class="min-[920px]:col-span-2" icon="outline-photo" title="Theme" hint="Named by colour. Applied at once, so you can judge it live.">
                      <ThemeSection />
                    </Card>
                    <Card icon="outline-eye" title="Accent" hint="The colour of buttons, links, focus rings and highlights, over any theme.">
                      <AccentSection />
                    </Card>
                    <Card icon="expand" title="Corners" hint="How round everything is. 0 squares the interface off, 200 rounds it out.">
                      <RadiusSection />
                    </Card>
                    <Card icon="outline-eye" title="Rainbow moves" hint="Only for the Rainbow theme: which part changes color.">
                      <RainbowSection />
                    </Card>
                    <Card icon="outline-photo" title="Background" hint="Your own picture behind the window. It is shrunk and kept in this app only.">
                      <BackgroundSection />
                      <WorkbenchSection />
                    </Card>
                    <Card icon="outline-text" title="Text color" hint="One color for all the text, over any theme.">
                      <TextColorSection />
                    </Card>
                    <Card icon="outline-text" title="Font" hint="Any font installed on this computer. Empty means the default.">
                      <FontSection />
                    </Card>
                    <Card icon="expand" title="Size" hint="Makes the whole app bigger or smaller.">
                      <SizeSection />
                    </Card>
                    <Card icon="outline-wave-audio" title="Motion" hint="Turn off the moving parts of the interface.">
                      <MotionSection />
                    </Card>
                    <Card icon="window-analytics" title="Settings window" hint="How solid this window is. Lower shows more of what is behind it.">
                      <DialogOpacitySection />
                    </Card>
                    <Card icon="outline-sliders" title="Chrome" hint="How much room the deck takes, and whether the band at the bottom shows.">
                      <ChromeSection />
                    </Card>
                  </div>
                </Match>
              </Switch>
            </div>
          </div>
        </div>
      </DialogBody>
    </Dialog>
  )
}

function DictationSection() {
  return (
    <div>
      <button type="button" class={chip(dictation().on)} onClick={() => setDictation({ on: !dictation().on })}>
        {dictation().on ? "Microphone on" : "Show microphone"}
      </button>
    </div>
  )
}

function ProxySection() {
  const infinite = usePlatform().infinite
  const [custom, setCustom] = createSignal("")
  const [url, setUrl] = createSignal("")
  const [note, setNote] = createSignal<{ ok: boolean; text: string } | undefined>()
  const [busy, setBusy] = createSignal(false)
  let file: HTMLInputElement | undefined
  onMount(() => void infinite?.getOptions().then((options) => setCustom(options.custom)))

  const append = (text: string) => setCustom((current) => `${current.trim()}\n${text}`.trim())

  // A URL that ends in a port is a proxy itself; any other URL is a list to download.
  const addUrl = async () => {
    const value = url().trim()
    if (!infinite || !value || busy()) return
    if (/:\d{1,5}\/?$/.test(value)) {
      append(value)
      setUrl("")
      return setNote({ ok: true, text: "Proxy added to the list. Press Save to use it." })
    }
    setBusy(true)
    setNote({ ok: true, text: "Downloading the list…" })
    try {
      const fetched = await infinite.fetchList(value)
      if (!fetched.ok) return setNote({ ok: false, text: "Could not download that URL (check the address and that it is plain text)." })
      append(fetched.text)
      setUrl("")
      setNote({ ok: true, text: "List downloaded and added. Press Save to use it." })
    } finally {
      setBusy(false)
    }
  }

  // The service reads its proxy only when it starts, so a change while Proxy is active re-applies the mode.
  const save = async (value: string) => {
    if (!infinite || busy()) return
    setBusy(true)
    setNote({ ok: true, text: "Saving…" })
    try {
      const options = await infinite.getOptions()
      const saved = await infinite.setOptions({ ...options, custom: value })
      setCustom(saved.custom)
      const count = saved.custom ? saved.custom.split("\n").length : 0
      const skipped = value.split(/[\s,;]+/).filter(Boolean).length - count
      const kept = `${count} ${count === 1 ? "proxy" : "proxies"}${skipped > 0 ? `, ${skipped} invalid skipped` : ""}`
      if ((await infinite.getMode()) !== "PROXY")
        return setNote({ ok: true, text: count ? `Saved ${kept}. Used when you pick Proxy.` : "Saved. Proxy uses the free list." })
      setNote({ ok: true, text: "Testing the proxies…" })
      const applied = await infinite.setMode("PROXY")
      setNote({ ok: applied.ok, text: applied.ok ? `Active. ${applied.message}` : applied.message })
    } catch (error) {
      setNote({ ok: false, text: error instanceof Error ? error.message : String(error) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <section class="flex flex-col gap-5">
      <div class="flex flex-col gap-2">
        <h3 class="text-13-medium text-v2-text-text-base">From a file</h3>
        <div class="flex items-center gap-3">
          <button type="button" class={chip(false)} disabled={busy()} onClick={() => file?.click()}>
            Choose file…
          </button>
          <span class="text-12-regular text-v2-text-text-faint">.txt, .csv or .list, one proxy per line</span>
        </div>
        <input
          ref={file}
          type="file"
          accept=".txt,.csv,.list,text/plain"
          class="hidden"
          onChange={async (event) => {
            const picked = event.currentTarget.files?.[0]
            event.currentTarget.value = ""
            if (!picked) return
            const text = await picked.text()
            append(text)
            setNote({ ok: true, text: `Loaded ${picked.name}. Press Save to use it.` })
          }}
        />
      </div>

      <div class="flex flex-col gap-2">
        <h3 class="text-13-medium text-v2-text-text-base">From a URL</h3>
        <div class="flex gap-2">
          <input
            type="text"
            class={field}
            placeholder="https://example.com/proxies.txt  or  http://host:3128"
            spellcheck={false}
            autocomplete="off"
            value={url()}
            onInput={(event) => setUrl(event.currentTarget.value)}
            onKeyDown={(event) => event.key === "Enter" && void addUrl()}
          />
          <button type="button" class={chip(false)} disabled={busy() || !url().trim()} onClick={() => void addUrl()}>
            Add
          </button>
        </div>
      </div>

      <div class="flex flex-col gap-2">
        <h3 class="text-13-medium text-v2-text-text-base">Your list</h3>
        <textarea
          rows={7}
          class={`${field} font-mono resize-y`}
          placeholder={"127.0.0.1:8080\nhttp://user:password@host:3128"}
          spellcheck={false}
          autocomplete="off"
          value={custom()}
          onInput={(event) => setCustom(event.currentTarget.value)}
        />
      </div>

      <div class="flex items-center gap-3 flex-wrap">
        <button type="button" class={chip(true)} disabled={busy()} onClick={() => void save(custom())}>
          Save
        </button>
        <button type="button" class={chip(false)} disabled={busy()} onClick={() => void save("")}>
          Use free list
        </button>
        <Show when={note()}>
          {(item) => (
            <span class="flex items-center gap-2 min-w-0 text-12-regular text-v2-text-text-muted" role="status">
              <span class="size-2 shrink-0 rounded-full" classList={{ "bg-green-500": item().ok, "bg-v2-state-fg-danger": !item().ok }} />
              <span class="truncate">{item().text}</span>
            </span>
          )}
        </Show>
      </div>
      <p class="text-12-regular text-v2-text-text-faint">
        With a list, Auto-rotate moves to another proxy of it. A single proxy cannot change the IP unless the provider rotates it.
      </p>
    </section>
  )
}

function ChainSection() {
  const infinite = usePlatform().infinite
  const [chain, setChain] = createSignal("")
  const [burned, setBurned] = createSignal(0)
  const [note, setNote] = createSignal<string>()
  onMount(() =>
    void infinite?.getOptions().then((options) => {
      setChain(options.chain)
      setBurned(options.burned)
    }),
  )

  const save = async () => {
    if (!infinite) return
    try {
      const saved = await infinite.setOptions({ ...(await infinite.getOptions()), chain: chain() })
      setChain(saved.chain)
      setNote(saved.chain ? `Saved: ${saved.chain}.` : "Cleared; only the chosen mode is used.")
    } catch (error) {
      setNote(error instanceof Error ? error.message : String(error))
    }
  }

  const forget = async () => {
    if (!infinite) return
    const done = await infinite.clearBurned()
    setBurned((await infinite.getOptions()).burned)
    setNote(done.message)
  }

  return (
    <section class="flex flex-col gap-3">
      <input
        class={`${field} font-mono`}
        placeholder="PROXY,SOCKS"
        spellcheck={false}
        autocomplete="off"
        value={chain()}
        onInput={(event) => setChain(event.currentTarget.value)}
      />
      <div class="flex items-center gap-3">
        <button type="button" class={chip(true)} onClick={() => void save()}>
          Save
        </button>
        <button type="button" class={chip(false)} onClick={() => void forget()}>
          Forget {burned()} used {burned() === 1 ? "IP" : "IPs"}
        </button>
        <Show when={note()}>{(value) => <span class="text-12-regular text-v2-text-text-muted">{value()}</span>}</Show>
      </div>
      <p class="text-12-regular text-v2-text-text-muted">
        A rotation never hands out an IP this run already used. Short lists start over on their own once every entry was
        used; forget them here to allow a known good one right away.
      </p>
    </section>
  )
}

function SocksSection() {
  const infinite = usePlatform().infinite
  const [text, setText] = createSignal("")
  const [note, setNote] = createSignal<string>()
  onMount(() => void infinite?.getOptions().then((options) => setText(options.socks)))

  const save = async () => {
    if (!infinite) return
    try {
      const options = await infinite.getOptions()
      const saved = await infinite.setOptions({ ...options, socks: text() })
      setText(saved.socks)
      const count = saved.socks ? saved.socks.split("\n").length : 0
      if ((await infinite.getMode()) === "SOCKS") {
        const applied = await infinite.setMode("SOCKS")
        return setNote(applied.ok ? `Active. ${applied.message}` : applied.message)
      }
      setNote(count ? `Saved ${count} ${count === 1 ? "server" : "servers"}. Used when you pick SOCKS5.` : "Cleared.")
    } catch (error) {
      setNote(error instanceof Error ? error.message : String(error))
    }
  }

  return (
    <section class="flex flex-col gap-3">
      <textarea
        rows={5}
        class={`${field} font-mono resize-y`}
        placeholder={"host:port\nsocks5://user:password@host:1080"}
        spellcheck={false}
        autocomplete="off"
        value={text()}
        onInput={(event) => setText(event.currentTarget.value)}
      />
      <div class="flex items-center gap-3">
        <button type="button" class={chip(true)} onClick={() => void save()}>
          Save
        </button>
        <Show when={note()}>{(value) => <span class="text-12-regular text-v2-text-text-muted">{value()}</span>}</Show>
      </div>
    </section>
  )
}

function DialogOpacitySection() {
  const [value, setValue] = createSignal(getDialogOpacity())
  return (
    <label class="flex items-center gap-3 text-12-regular text-v2-text-text-muted">
      <span class="w-40 shrink-0">Window opacity {value()}%</span>
      <input
        type="range"
        min="30"
        max="100"
        value={value()}
        class="flex-1"
        onInput={(event) => {
          setDialogOpacity(Number(event.currentTarget.value))
          setValue(getDialogOpacity())
        }}
      />
    </label>
  )
}

// Room the deck takes and whether the bottom band exists. Both are chrome, not colour, so they live here.
function ChromeSection() {
  return (
    <div class="flex flex-col gap-3">
      <div class="flex flex-col gap-1.5">
        <span class="text-[11px] uppercase tracking-[0.16em] text-v2-text-text-faint">Deck density</span>
        <div class="flex gap-2">
          <button type="button" class={chip(deckDensity() === "compact")} onClick={() => setDeckDensity("compact")}>
            Compact
          </button>
          <button type="button" class={chip(deckDensity() === "comfortable")} onClick={() => setDeckDensity("comfortable")}>
            Comfortable
          </button>
        </div>
      </div>
      <div class="flex flex-col gap-1.5">
        <span class="text-[11px] uppercase tracking-[0.16em] text-v2-text-text-faint">Bottom band</span>
        <div class="flex gap-2">
          <button type="button" class={chip(statusBand())} onClick={() => setStatusBand(true)}>
            Show
          </button>
          <button type="button" class={chip(!statusBand())} onClick={() => setStatusBand(false)}>
            Hide
          </button>
        </div>
        <span class="text-[11px] text-v2-text-text-faint">
          Hiding it keeps the HUD editor reachable from this window.
        </span>
      </div>
    </div>
  )
}

// One highlight colour for the whole interface, over any theme; without it the theme decides.
const ACCENT_PRESETS = ["#d2404c", "#e0803a", "#d8b04a", "#50a27a", "#3fa9c9", "#4a7fe0", "#8b6cf0", "#d0559b"]

function AccentSection() {
  const [color, setColor] = createSignal(getAccent())
  const pick = (value: string) => {
    setAccent(value)
    setColor(getAccent())
  }

  return (
    <div class="flex flex-col gap-3">
      <div class="flex flex-wrap items-center gap-3">
        <input
          type="color"
          aria-label="Accent color"
          class="h-9 w-14 cursor-pointer rounded-lg bg-transparent"
          value={color() || "#d2404c"}
          onInput={(event) => pick(event.currentTarget.value)}
        />
        <button type="button" class={chip(false)} disabled={!color()} onClick={() => pick("")}>
          Use the theme's
        </button>
      </div>
      <div class="flex flex-wrap gap-1.5">
        <For each={ACCENT_PRESETS}>
          {(value) => (
            <button
              type="button"
              class="size-6 rounded-full border border-v2-border-border-muted transition-transform hover:scale-110"
              classList={{ "ring-2 ring-v2-text-text-accent": color().toLowerCase() === value }}
              style={{ "background-color": value }}
              aria-label={`Accent ${value}`}
              aria-pressed={color().toLowerCase() === value}
              onClick={() => pick(value)}
            />
          )}
        </For>
      </div>
    </div>
  )
}

// Corner roundness, read off the design tokens so every rounded surface moves together.
function RadiusSection() {
  const [value, setValue] = createSignal(getRadius())
  const change = (next: number) => {
    setRadius(next)
    setValue(getRadius())
  }

  return (
    <div class="flex flex-col gap-3">
      <div class="flex items-center gap-3">
        <input
          type="range"
          min="0"
          max="200"
          step="10"
          value={value()}
          aria-label="Corner roundness"
          class="flex-1"
          onInput={(event) => change(Number(event.currentTarget.value))}
        />
        <span class="w-12 shrink-0 text-end font-mono text-12-regular text-v2-text-text-muted">{value()}%</span>
      </div>
      <div class="flex flex-wrap gap-1.5">
        <For each={[0, 50, 100, 150, 200]}>
          {(preset) => (
            <button type="button" class={chip(value() === preset)} onClick={() => change(preset)}>
              {preset === 100 ? "Theme" : `${preset}%`}
            </button>
          )}
        </For>
      </div>
      <div class="flex items-center gap-2 text-[11px] text-v2-text-text-faint">
        <span class="h-8 w-12 border border-v2-border-border-base bg-v2-background-bg-layer-02" style={{ "border-radius": `${(value() / 100) * 10}px` }} />
        <span>Preview — the corner follows the setting.</span>
      </div>
    </div>
  )
}

// One color for all the text, over any theme; without it the theme decides (and Rainbow makes the text flow).
function TextColorSection() {
  const [color, setColor] = createSignal(getTextColor())
  const pick = (value: string) => {
    setTextColor(value)
    setColor(getTextColor())
  }

  return (
    <div class="flex flex-col gap-2">
      <h3 class="text-13-medium text-v2-text-text-base">Text color</h3>
      <div class="flex items-center gap-3 flex-wrap">
        <input
          type="color"
          aria-label="Text color"
          class="h-9 w-14 rounded-lg bg-transparent cursor-pointer"
          value={color() || "#ffffff"}
          onInput={(event) => pick(event.currentTarget.value)}
        />
        <button type="button" class={chip(false)} disabled={!color()} onClick={() => pick("")}>
          Use the theme's
        </button>
        <span class="text-12-regular text-v2-text-text-faint">
          {color() ? `${color()} on every theme` : "The theme's own colors; the Rainbow theme changes them when its target is Text"}
        </span>
      </div>
    </div>
  )
}

/** route64: import the .conf the manager gives you, then connect. Desktop only; the bridge is missing elsewhere. */
// Optional URL that changes the IP when opened; Proxy mode calls it before each rotation.
function ChangeIpSection() {
  const infinite = usePlatform().infinite
  const [rotateUrl, setRotateUrl] = createSignal("")
  const [note, setNote] = createSignal<string>()
  onMount(() => void infinite?.getOptions().then((options) => setRotateUrl(options.rotateUrl)))

  const save = async () => {
    if (!infinite) return
    try {
      const options = await infinite.getOptions()
      const saved = await infinite.setOptions({ ...options, rotateUrl: rotateUrl().trim() })
      setRotateUrl(saved.rotateUrl)
      setNote(saved.rotateUrl ? "Saved." : "Cleared.")
    } catch (error) {
      setNote(error instanceof Error ? error.message : String(error))
    }
  }

  return (
    <Show when={infinite}>
      <div class="flex flex-col gap-3">
        <h3 class="text-13-medium text-v2-text-text-base">Change-IP URL (optional)</h3>
        <p class="text-13-regular text-v2-text-text-muted">
          Some providers change the IP when a URL is opened. Leave empty if your proxy already changes the IP per request.
        </p>
        <input
          type="text"
          class={field}
          placeholder="https://provider.example/rotate?key=…"
          spellcheck={false}
          autocomplete="off"
          value={rotateUrl()}
          onInput={(event) => setRotateUrl(event.currentTarget.value)}
        />
        <div class="flex items-center gap-3">
          <button type="button" class={chip(true)} onClick={() => void save()}>
            Save
          </button>
          <Show when={note()}>
            <span class="text-12-regular text-v2-text-text-faint">{note()}</span>
          </Show>
        </div>
      </div>
    </Show>
  )
}

function VpnLocationsSection() {
  const infinite = usePlatform().infinite
  const [locations, setLocations] = createSignal("")
  const [note, setNote] = createSignal<string>()
  onMount(() => void infinite?.getOptions().then((options) => setLocations(options.vpnLocations)))

  const save = async () => {
    if (!infinite) return
    try {
      const options = await infinite.getOptions()
      const saved = await infinite.setOptions({ ...options, vpnLocations: locations() })
      setLocations(saved.vpnLocations)
      setNote("Saved.")
    } catch (error) {
      setNote(error instanceof Error ? error.message : String(error))
    }
  }

  return (
    <Show when={infinite}>
      <div class="flex flex-col gap-3">
        <input
          type="text"
          class={field}
          placeholder="Mullvad: se, de, nl   Windscribe: US-East, UK"
          spellcheck={false}
          autocomplete="off"
          value={locations()}
          onInput={(event) => setLocations(event.currentTarget.value)}
        />
        <div class="flex items-center gap-3">
          <button type="button" class={chip(true)} onClick={() => void save()}>
            Save
          </button>
          <Show when={note()}>
            <span class="text-12-regular text-v2-text-text-faint">{note()}</span>
          </Show>
        </div>
      </div>
    </Show>
  )
}

function Route64Section() {
  const infinite = usePlatform().infinite
  const [status, setStatus] = createSignal<{ imported: boolean; endpoint?: string; up: boolean }>()
  const [note, setNote] = createSignal<string>()
  let file: HTMLInputElement | undefined
  const refresh = () => void infinite?.route64Status().then(setStatus)
  onMount(refresh)

  const load = async (input: HTMLInputElement) => {
    const picked = input.files?.[0]
    input.value = ""
    if (!picked) return
    const result = await infinite?.route64Import(await picked.text())
    setNote(result?.message)
    refresh()
  }

  const act = async (run: () => Promise<{ message: string } | undefined> | undefined) => {
    const result = await run()
    setNote(result?.message)
    refresh()
  }

  // Connecting is the Route64 choice in the deck: it installs WireGuard if needed and brings the tunnel up.
  return (
    <Show when={infinite}>
      <div class="flex flex-col gap-3">
        <div class="flex items-center gap-3 flex-wrap">
          <button type="button" class={chip(false)} onClick={() => file?.click()}>
            {status()?.imported ? "Replace .conf…" : "Import .conf…"}
          </button>
          <button type="button" class={chip(false)} disabled={!status()?.imported} onClick={() => void act(() => infinite?.route64Remove())}>
            Remove
          </button>
        </div>
        <span class="text-12-regular text-v2-text-text-muted">
          {status()?.imported
            ? `Config saved. Endpoint ${status()?.endpoint}${status()?.up ? " · tunnel up" : " · tunnel down"}`
            : "No config yet. Download the .conf from manager.route64.org."}
        </span>
        <Show when={note()}>
          <span class="text-12-regular text-v2-text-text-base">{note()}</span>
        </Show>
        <input ref={file} type="file" accept=".conf" class="hidden" onChange={(event) => void load(event.currentTarget)} />
      </div>
    </Show>
  )
}

// Two-letter country code for the proxy pick; empty means any. Saved on blur, no extra button.
function CountryField() {
  const infinite = usePlatform().infinite
  const [country, setCountry] = createSignal("")
  const [note, setNote] = createSignal<string>()
  onMount(() => void infinite?.getOptions().then((options) => setCountry(options.country)))

  const save = async (value: string) => {
    const code = value.trim().toUpperCase()
    if (code && !/^[A-Z]{2}$/.test(code)) return setNote("Use two letters, like ES.")
    const options = await infinite?.getOptions()
    if (!options) return
    await infinite?.setOptions({ ...options, country: code })
    setCountry(code)
    setNote(code ? `Exit country set to ${code}.` : "Any country.")
  }

  return (
    <div class="flex items-center gap-3 flex-wrap">
      <input
        type="text"
        maxLength={2}
        class={`${field} w-24`}
        placeholder="Any"
        value={country()}
        spellcheck={false}
        autocomplete="off"
        onInput={(event) => setCountry(event.currentTarget.value.toUpperCase())}
        onBlur={(event) => void save(event.currentTarget.value)}
        onKeyDown={(event) => event.key === "Enter" && void save(event.currentTarget.value)}
      />
      <Show when={note()}>{(text) => <span class="text-12-regular text-v2-text-text-muted">{text()}</span>}</Show>
    </div>
  )
}

// Fast mode: skips the IP probe before "continue" (see infinite.ts hunt). Saved at once, like the country.
function FastField() {
  const infinite = usePlatform().infinite
  const [fast, setFast] = createSignal(false)
  onMount(() => void infinite?.getOptions().then((options) => setFast(options.fast)))

  const save = async (next: boolean) => {
    const options = await infinite?.getOptions()
    if (!options) return
    await infinite?.setOptions({ ...options, fast: next })
    setFast(next)
  }

  return (
    <label class="flex items-center gap-2 text-12-regular text-v2-text-text-muted">
      <input type="checkbox" checked={fast()} onChange={(event) => void save(event.currentTarget.checked)} />
      Fast mode
    </label>
  )
}

// How many IPs one Auto-rotate tries before it gives up (see infinite.ts hunt). Saved when the field is left.
function AttemptsField() {
  const infinite = usePlatform().infinite
  const [attempts, setAttempts] = createSignal(10)
  onMount(() => void infinite?.getOptions().then((options) => setAttempts(options.attempts)))

  const save = async (value: string) => {
    const options = await infinite?.getOptions()
    if (!options) return
    // The main process clamps it to 1-50; the field shows what was really kept.
    const kept = await infinite?.setOptions({ ...options, attempts: Number(value) })
    if (kept) setAttempts(kept.attempts)
  }

  return (
    <label class="flex items-center gap-2 text-12-regular text-v2-text-text-muted">
      <input
        type="number"
        min="1"
        max="50"
        class={field.replace("w-full", "w-20")}
        value={attempts()}
        onChange={(event) => void save(event.currentTarget.value)}
      />
      IPs to try per rotation
    </label>
  )
}

// opendeath: whether a chat left waiting for an IP is continued after the app is relaunched. Saved at once.
function ResumeField() {
  const infinite = usePlatform().infinite
  const [resume, setResume] = createSignal(true)
  onMount(() => void infinite?.getOptions().then((options) => setResume(options.resume)))

  const save = async (next: boolean) => {
    const options = await infinite?.getOptions()
    if (!options) return
    const kept = await infinite?.setOptions({ ...options, resume: next })
    if (kept) setResume(kept.resume)
  }

  return (
    <label class="flex items-center gap-2 text-12-regular text-v2-text-text-muted">
      <input type="checkbox" checked={resume()} onChange={(event) => void save(event.currentTarget.checked)} />
      Resume waiting chats after a relaunch
    </label>
  )
}

// Basic: the connection itself is picked in the deck. Here are the settings that change how it behaves.
// Restore defaults: free proxy list, Auto-rotate on, no background, theme text color; the theme itself is kept.
function BasicSection() {
  const infinite = usePlatform().infinite
  const [note, setNote] = createSignal<{ ok: boolean; text: string }>()
  const [busy, setBusy] = createSignal(false)

  const restore = async () => {
    if (!infinite || busy()) return
    setBusy(true)
    try {
      const options = await infinite.getOptions()
      await infinite.setOptions({ ...options, auto: true, country: "", custom: "", fast: false })
      clearBackground()
      setTextColor("")
      setNote({ ok: true, text: "Defaults restored: free proxy list, Auto-rotate on, no background, theme colors." })
    } catch (error) {
      setNote({ ok: false, text: error instanceof Error ? error.message : String(error) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Card
        icon="outline-globe"
        title="Exit country"
        hint="Two letters, like ES or DE, for proxies from that country. Leave empty for any country."
      >
        <CountryField />
      </Card>

      <Card
        icon="outline-rotate-clockwise"
        title="Speed"
        hint='Fast mode sends "continue" as soon as the IP changes, without checking it first: about 3 to 4 s instead of about 7 s. If the new IP is already limited, the chat hits the limit again and rotates again.'
      >
        <FastField />
      </Card>

      <Card
        icon="outline-reset"
        class="min-[920px]:col-span-2"
        title="Auto-rotate attempts"
        hint="How many new IPs Auto-rotate tries, each checked on a temporary session, before it stops and tells you. More attempts find a free IP more often but can take longer. 1 to 50, default 10."
      >
        <AttemptsField />
      </Card>

      <Card
        icon="outline-undo"
        tone="accent"
        class="min-[920px]:col-span-2"
        title="Continue after relaunch"
        hint="A chat that was waiting for a fresh IP when the app closed is continued on its own the next time opendeath starts: it finds a working IP and sends continue. Chats older than half a day are forgotten."
      >
        <ResumeField />
      </Card>

      <Card
        icon="outline-list-changelog"
        class="min-[920px]:col-span-2"
        title="Recent connection changes"
        hint="The last ten changes on this computer. Nothing is sent anywhere."
      >
        <div class="flex flex-col gap-1">
          <For each={readHistory()} fallback={<span class="text-12-regular text-v2-text-text-faint">No changes yet.</span>}>
            {(entry) => (
              <span class="text-12-regular text-v2-text-text-muted">
                {new Date(entry.at).toLocaleTimeString()} · {entry.mode} · {entry.ok ? "ok" : "failed"}
                {entry.ip ? ` · IP ${entry.ip}` : ""}
              </span>
            )}
          </For>
        </div>
      </Card>

      <Card
        icon="outline-reset"
        class="min-[920px]:col-span-2"
        title="Reset"
        hint="Puts back the free proxy list, turns Auto-rotate on and Fast mode off, and removes your background and text color."
      >
        <div class="flex items-center gap-3 flex-wrap">
          <button type="button" class={chip(false)} disabled={busy()} onClick={() => void restore()}>
            Restore defaults
          </button>
          <Show when={note()}>
            {(item) => (
              <span class="flex items-center gap-2 min-w-0 text-12-regular text-v2-text-text-muted" role="status">
                <span class="size-2 shrink-0 rounded-full" classList={{ "bg-green-500": item().ok, "bg-v2-state-fg-danger": !item().ok }} />
                <span>{item().text}</span>
              </span>
            )}
          </Show>
        </div>
      </Card>
    </>
  )
}

const rainbowTargets: { id: RainbowTarget; label: string }[] = [
  { id: "text", label: "Text" },
  { id: "background", label: "Background" },
]

// Only the rainbow theme reads this: the letters or the window change color, never the buttons and borders.
function RainbowSection() {
  const [target, setTarget] = createSignal<RainbowTarget>(getRainbow())
  const pick = (id: RainbowTarget) => {
    setRainbow(id)
    setTarget(id)
  }
  return (
    <div class="flex flex-col gap-3">
      <div class="flex gap-2 flex-wrap">
        <For each={rainbowTargets}>
          {(item) => (
            <button type="button" class={chip(target() === item.id)} onClick={() => pick(item.id)}>
              {item.label}
            </button>
          )}
        </For>
      </div>
      <p class="text-12-regular text-v2-text-text-faint">Text: the letters change color. Background: the window changes color.</p>
    </div>
  )
}

const fontRows = [
  { label: "Interface font", kind: "ui" as const },
  { label: "Code font", kind: "code" as const },
  { label: "Terminal font", kind: "terminal" as const },
]

function FontSection() {
  const appearance = createAppearanceSettingsController()
  const set = { ui: appearance.fonts.setUI, code: appearance.fonts.setCode, terminal: appearance.fonts.setTerminal }
  return (
    <div class="flex flex-col gap-4">
      <For each={fontRows}>
        {(row) => (
          <label class="flex flex-col gap-1.5">
            <span class="text-13-medium text-v2-text-text-base">{row.label}</span>
            <input
              type="text"
              class={field}
              style={{ "font-family": appearance.fonts[row.kind]().family }}
              placeholder={appearance.fonts[row.kind]().placeholder}
              value={appearance.fonts[row.kind]().value}
              spellcheck={false}
              autocomplete="off"
              onInput={(event) => set[row.kind](event.currentTarget.value)}
            />
          </label>
        )}
      </For>
    </div>
  )
}

function SizeSection() {
  const appearance = createAppearanceSettingsController()
  return (
    <Show when={appearance.zoom.available()}>
      <div class="flex gap-2 flex-wrap">
        <For each={appearance.zoom.options}>
          {(level) => (
            <button type="button" class={chip(appearance.zoom.current() === level)} onClick={() => appearance.zoom.select(level)}>
              {appearance.zoom.label(level)}
            </button>
          )}
        </For>
      </div>
    </Show>
  )
}

const motionOptions = [
  { value: "system", label: "System" },
  { value: "on", label: "Reduced" },
  { value: "off", label: "Full" },
] as const

function MotionSection() {
  const appearance = createAppearanceSettingsController()
  return (
    <div class="flex gap-2 flex-wrap">
      <For each={motionOptions}>
        {(item) => (
          <button type="button" class={chip(appearance.reduceMotion.current() === item.value)} onClick={() => appearance.reduceMotion.select(item.value)}>
            {item.label}
          </button>
        )}
      </For>
    </div>
  )
}

function ThemeSection() {
  const theme = useTheme()
  onMount(() => void theme.loadThemes())

  // Rainbow first, then the pastel themes; the rest keep their alphabetical order.
  const rank = (id: string) => (id === "rainbow" ? 2 : id.startsWith("pastel") ? 1 : 0)
  const ids = () => [...theme.ids()].sort((a, b) => rank(b) - rank(a))

  return (
    <section class="flex flex-col gap-5">
      <div class="flex flex-col gap-2">
        <h3 class="text-13-medium text-v2-text-text-base">Mode</h3>
        <div class="flex gap-2">
          <For each={schemes}>
            {(scheme) => (
              <button type="button" class={chip(theme.colorScheme() === scheme)} onClick={() => theme.setColorScheme(scheme)}>
                {scheme[0]!.toUpperCase() + scheme.slice(1)}
              </button>
            )}
          </For>
        </div>
      </div>
      <div class="flex flex-col gap-2">
        <h3 class="text-13-medium text-v2-text-text-base">Theme</h3>
        <div class="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          <For each={ids()}>
            {(id) => (
              <button type="button" class={`${chip(theme.themeId() === id)} truncate text-start`} onClick={() => theme.setTheme(id)}>
                {theme.name(id)}
              </button>
            )}
          </For>
        </div>
      </div>
    </section>
  )
}
