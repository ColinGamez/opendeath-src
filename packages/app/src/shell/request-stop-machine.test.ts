import { expect, test } from "bun:test"
import { transitionRequestStop } from "./request-stop-machine"

test("stop retries after a failure and ignores completions after disposal", () => {
  const pending = transitionRequestStop({ status: "idle" }, "start")
  expect(transitionRequestStop(pending, "start")).toBe(pending)
  expect(transitionRequestStop(pending, "success")).toEqual({ status: "done" })
  const failure = transitionRequestStop(pending, "failure")
  expect(failure).toEqual({ status: "error" })
  expect(transitionRequestStop(failure, "start")).toEqual({ status: "pending" })
  const disposed = transitionRequestStop(pending, "dispose")
  expect(transitionRequestStop(disposed, "success")).toBe(disposed)
})
