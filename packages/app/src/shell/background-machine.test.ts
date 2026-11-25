import { expect, test } from "bun:test"
import { transitionBackground } from "./background-machine"

test("image import claims the picker and rejects stale completions", () => {
  const loading = transitionBackground({ status: "idle" }, { type: "choose", attempt: "one" })
  expect(transitionBackground(loading, { type: "choose", attempt: "two" })).toBe(loading)
  expect(transitionBackground(loading, { type: "clear" })).toBe(loading)
  expect(transitionBackground(loading, { type: "done", attempt: "two" })).toBe(loading)
  expect(transitionBackground(loading, { type: "done", attempt: "one" })).toEqual({ status: "idle" })
  expect(transitionBackground(loading, { type: "done", attempt: "one", error: "background.error.read" })).toEqual({
    status: "error",
    error: "background.error.read",
  })
  const disposed = transitionBackground(loading, { type: "dispose" })
  expect(transitionBackground(disposed, { type: "done", attempt: "one" })).toBe(disposed)
})
