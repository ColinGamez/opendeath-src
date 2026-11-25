export type RequestStopState = { status: "idle" | "pending" | "done" | "error" | "disposed" }
export function transitionRequestStop(
  state: RequestStopState,
  event: "start" | "success" | "failure" | "dispose",
): RequestStopState {
  if (state.status === "disposed") return state
  if (event === "dispose") return { status: "disposed" }
  if (event === "start") return state.status === "idle" || state.status === "error" ? { status: "pending" } : state
  if (state.status !== "pending") return state
  return { status: event === "success" ? "done" : "error" }
}
