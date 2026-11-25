import { createSignal, onCleanup, Show } from "solid-js"
import { useLanguage } from "@/runtime/i18n/language"
import { useGlobal } from "@/runtime/server/runtime"
import { ServerConnection } from "@/runtime/server/registry"
import { type RequestDiagnostic } from "./request-diagnostics"
import { transitionRequestStop, type RequestStopState } from "./request-stop-machine"

export function RequestStop(props: { request: RequestDiagnostic }) {
  const language = useLanguage()
  const global = useGlobal()
  const [state, setState] = createSignal<RequestStopState>({ status: "idle" })
  const controller = new AbortController()
  onCleanup(() => {
    setState((current) => transitionRequestStop(current, "dispose"))
    controller.abort()
  })
  const stop = async () => {
    if (state().status !== "idle" && state().status !== "error") return
    setState((current) => transitionRequestStop(current, "start"))
    const server = global.servers.list().find((item) => ServerConnection.key(item) === props.request.serverKey)
    const sdk = server && global.serverCtx(ServerConnection.key(server))?.sdk
    if (!sdk) return setState((current) => transitionRequestStop(current, "failure"))
    await sdk.api.session
      .interrupt(
        { sessionID: props.request.sessionID },
        { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]) },
      )
      .then(
        () => setState((current) => transitionRequestStop(current, "success")),
        () => setState((current) => transitionRequestStop(current, "failure")),
      )
  }
  return (
    <div class="mt-2 flex flex-col gap-2">
      <button
        type="button"
        class="rounded-lg border border-v2-border-border-muted px-3 py-2 disabled:opacity-50"
        disabled={state().status === "pending" || state().status === "done"}
        onClick={() => void stop()}
      >
        {language.t(
          state().status === "pending"
            ? "connection.stop.pending"
            : state().status === "done"
              ? "connection.stop.done"
              : "connection.stop.label",
        )}
      </button>
      <Show when={state().status === "error"}>
        <p role="alert">{language.t("connection.stop.error")}</p>
      </Show>
    </div>
  )
}
