import { For, Show } from "solid-js"
import { createStore, reconcile, unwrap } from "solid-js/store"
import { Schema } from "effect"
import { useLanguage } from "@/runtime/i18n/language"
import { persisted } from "@/runtime/persistence/storage"
import { Persistence } from "@/runtime/persistence/schema"
import { settingsSchema, useSettings } from "@/settings/model"

const presetsSchema = Persistence.struct({
  presets: Schema.Array(Persistence.struct({ name: Schema.String, settings: settingsSchema })),
  restorePoint: Persistence.optional(settingsSchema),
})

export function WorkbenchSection() {
  const settings = useSettings()
  const language = useLanguage()
  const [saved, setSaved, , ready] = persisted({ key: "opendeath.workbench-presets.v1" }, presetsSchema, {
    presets: [],
  })
  const [form, setForm] = createStore({ name: "", notice: "" as "" | "workbench.saved" | "workbench.restored" })
  const control =
    "rounded-lg border border-v2-border-border-muted bg-v2-background-bg-layer-02 px-3 py-2 text-13-regular disabled:opacity-50"
  const snapshot = () => structuredClone(unwrap(settings.current))
  return (
    <section class="flex flex-col gap-3 border-t border-v2-border-border-muted pt-4">
      <h3 class="text-13-medium">{language.t("workbench.title")}</h3>
      <label class="flex items-center gap-2">
        <input
          type="checkbox"
          checked={settings.general.followUpBehavior() === "queue"}
          onChange={(event) => settings.general.setFollowUpBehavior(event.currentTarget.checked ? "queue" : "steer")}
        />
        {language.t("workbench.queue")}
      </label>
      <label class="flex items-center gap-2">
        <input
          type="checkbox"
          checked={settings.notifications.agent()}
          onChange={(event) => settings.notifications.setAgent(event.currentTarget.checked)}
        />
        {language.t("workbench.notify")}
      </label>
      <label class="flex items-center gap-2">
        <input
          type="checkbox"
          checked={settings.general.showTurnDiffs()}
          onChange={(event) => settings.general.setShowTurnDiffs(event.currentTarget.checked)}
        />
        {language.t("workbench.review")}
      </label>
      <p class="text-12-regular text-v2-text-text-muted">{language.t("workbench.presets")}</p>
      <div class="flex gap-2">
        <input
          class={`${control} min-w-0 flex-1`}
          maxlength={60}
          value={form.name}
          aria-label={language.t("workbench.name")}
          placeholder={language.t("workbench.name")}
          onInput={(event) => setForm("name", event.currentTarget.value)}
        />
        <button
          class={control}
          type="button"
          disabled={!ready() || !settings.ready() || !form.name.trim() || saved.presets.length >= 12}
          onClick={() => {
            setSaved("presets", [
              ...saved.presets.filter((item) => item.name !== form.name.trim()),
              { name: form.name.trim(), settings: snapshot() },
            ])
            setForm({ name: "", notice: "workbench.saved" })
          }}
        >
          {language.t("workbench.save")}
        </button>
      </div>
      <For each={saved.presets}>
        {(preset) => (
          <div class="flex items-center gap-2">
            <span class="flex-1 truncate">{preset.name}</span>
            <button
              class={control}
              type="button"
              disabled={!ready() || !settings.ready()}
              onClick={() => {
                setSaved("restorePoint", reconcile(snapshot()))
                settings.restore(preset.settings)
                setForm("notice", "workbench.restored")
              }}
            >
              {language.t("workbench.apply")}
            </button>
            <button
              class={control}
              type="button"
              onClick={() =>
                setSaved(
                  "presets",
                  saved.presets.filter((item) => item.name !== preset.name),
                )
              }
            >
              {language.t("workbench.delete")}
            </button>
          </div>
        )}
      </For>
      <div class="flex flex-wrap gap-2">
        <button
          class={control}
          type="button"
          disabled={!ready() || !settings.ready()}
          onClick={() => {
            setSaved("restorePoint", reconcile(snapshot()))
            setForm("notice", "workbench.saved")
          }}
        >
          {language.t("workbench.checkpoint")}
        </button>
        <button
          class={control}
          type="button"
          disabled={!ready() || !settings.ready() || !saved.restorePoint}
          onClick={() => {
            const restorePoint = saved.restorePoint
            if (!restorePoint) return
            const previous = snapshot()
            settings.restore(restorePoint)
            setSaved("restorePoint", reconcile(previous))
            setForm("notice", "workbench.restored")
          }}
        >
          {language.t("workbench.restore")}
        </button>
      </div>
      <Show when={form.notice}>{(notice) => <p role="status">{language.t(notice())}</p>}</Show>
    </section>
  )
}
