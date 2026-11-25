import { For, Show, createSignal, onCleanup } from "solid-js"
import { createStore } from "solid-js/store"
import { uuid } from "@opencode/util/uuid"
import { useLanguage } from "@/runtime/i18n/language"
import { transitionBackground, type BackgroundState } from "./background-machine"
import {
  backgroundFits,
  backgroundPositions,
  clearBackground,
  getBackground,
  setBackgroundFile,
  setBackgroundLayout,
  setBackgroundOpacity,
} from "./infinite-look"

export function BackgroundSection() {
  const language = useLanguage()
  const [look, setLook] = createStore(getBackground())
  const [state, setState] = createSignal<BackgroundState>({ status: "idle" })
  const controller = new AbortController()
  const busy = () => state().status === "loading"
  const error = () => {
    const current = state()
    return current.status === "error" ? current.error : undefined
  }
  const refresh = () => setLook(getBackground())
  onCleanup(() => {
    setState((current) => transitionBackground(current, { type: "dispose" }))
    controller.abort()
  })
  const choose = async (file: File) => {
    if (busy()) return
    const attempt = uuid()
    setState((current) => transitionBackground(current, { type: "choose", attempt }))
    const timeout = new AbortController()
    const timer = setTimeout(() => timeout.abort(), 15_000)
    const signal = AbortSignal.any([controller.signal, timeout.signal])
    const error = await setBackgroundFile(file, signal).catch(() => "background.error.read" as const)
    clearTimeout(timer)
    setState((current) => transitionBackground(current, { type: "done", attempt, error }))
    if (!controller.signal.aborted) refresh()
  }
  const control =
    "rounded-lg border border-v2-border-border-muted bg-v2-background-bg-layer-02 px-3 py-2 text-13-regular disabled:opacity-50"
  return (
    <section class="flex flex-col gap-3 py-3">
      <h3 class="text-13-medium">{language.t("background.title")}</h3>
      <p class="text-12-regular text-v2-text-text-muted">{language.t("background.description")}</p>
      <input
        type="file"
        accept="image/png,image/jpeg,image/webp"
        disabled={busy()}
        aria-label={language.t("background.choose")}
        class={control}
        onChange={(event) => {
          const file = event.currentTarget.files?.[0]
          event.currentTarget.value = ""
          if (file) void choose(file)
        }}
      />
      <Show when={busy()}>
        <p role="status">{language.t("background.loading")}</p>
      </Show>
      <Show when={look.image}>
        <div
          class="h-40 rounded-xl border border-v2-border-border-muted overflow-hidden"
          style={{
            "background-image": `url("${look.image}")`,
            "background-size": look.fit,
            "background-position": look.position,
            "background-repeat": "no-repeat",
          }}
        >
          <div
            class="h-full flex items-center justify-center text-13-regular"
            style={{ background: `color-mix(in srgb, var(--infinite-solid-base) ${look.opacity}%, transparent)` }}
          >
            {language.t("background.preview")}
          </div>
        </div>
        <label class="flex items-center gap-3 text-13-regular">
          {language.t("background.opacity", { value: look.opacity })}
          <input
            type="range"
            min="30"
            max="100"
            value={look.opacity}
            class="flex-1"
            onInput={(event) => {
              setBackgroundOpacity(Number(event.currentTarget.value))
              refresh()
            }}
          />
        </label>
        <div class="flex flex-wrap gap-3">
          <label>
            {language.t("background.fit")}{" "}
            <select
              class={control}
              value={look.fit}
              onChange={(event) => {
                const fit = backgroundFits.find((item) => item === event.currentTarget.value)
                if (fit) setBackgroundLayout(fit, look.position)
                refresh()
              }}
            >
              <For each={backgroundFits}>
                {(fit) => <option value={fit}>{language.t(`background.fit.${fit}`)}</option>}
              </For>
            </select>
          </label>
          <label>
            {language.t("background.position")}{" "}
            <select
              class={control}
              value={look.position}
              onChange={(event) => {
                const position = backgroundPositions.find((item) => item === event.currentTarget.value)
                if (position) setBackgroundLayout(look.fit, position)
                refresh()
              }}
            >
              <For each={backgroundPositions}>
                {(position) => <option value={position}>{language.t(`background.position.${position}`)}</option>}
              </For>
            </select>
          </label>
          <button
            type="button"
            class={control}
            disabled={busy()}
            onClick={() => {
              clearBackground()
              refresh()
              setState((current) => transitionBackground(current, { type: "clear" }))
            }}
          >
            {language.t("background.remove")}
          </button>
        </div>
      </Show>
      <Show when={error()}>
        {(message) => (
          <p role="alert" class="text-v2-state-fg-danger">
            {language.t(message())}
          </p>
        )}
      </Show>
    </section>
  )
}
