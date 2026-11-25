import type { BackgroundError } from "./infinite-look"
export type BackgroundState =
  | { status: "idle" }
  | { status: "loading"; attempt: string }
  | { status: "error"; error: BackgroundError }
  | { status: "disposed" }

export type BackgroundEvent =
  | { type: "choose"; attempt: string }
  | { type: "done"; attempt: string; error?: BackgroundError }
  | { type: "clear" }
  | { type: "dispose" }

export function transitionBackground(state: BackgroundState, event: BackgroundEvent): BackgroundState {
  if (state.status === "disposed") return state
  if (event.type === "dispose") return { status: "disposed" }
  if (event.type === "done") {
    if (state.status !== "loading" || state.attempt !== event.attempt) return state
    return event.error ? { status: "error", error: event.error } : { status: "idle" }
  }
  if (state.status === "loading") return state
  if (event.type === "choose") return { status: "loading", attempt: event.attempt }
  return { status: "idle" }
}
