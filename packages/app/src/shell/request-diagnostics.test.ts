import { expect, test } from "bun:test"
import { requestDiagnostics, type RequestDiagnostic, type RequestEvent } from "./request-diagnostics"

const base = { id: "start", sessionID: "chat", messageID: "message", at: 100 }
const start: RequestEvent = { ...base, type: "started", model: "model", provider: "provider" }
const retry: RequestEvent = {
  ...base,
  id: "retry",
  at: 200,
  type: "retrying",
  error: "provider.free-limit: Free usage limit reached",
  attempt: 3,
  retryAt: 1700,
}

test("a successful retry preserves the error and model that explain the recovery", () => {
  const started = requestDiagnostics([], start)
  const waiting = requestDiagnostics(started, retry)
  expect(waiting[0]).toMatchObject({ status: "retrying", model: "model", attempt: 3, retryAt: 1700 })
  const done = requestDiagnostics(waiting, { ...base, id: "done", at: 300, type: "completed" })
  expect(done[0]).toMatchObject({ status: "recovered", error: retry.error, model: "model", attempt: 3 })
  expect(done[0]?.retryAt).toBeUndefined()
})

test("reconnect replays and duplicates cannot replace a newer failure", () => {
  const failed = requestDiagnostics(requestDiagnostics([], start), {
    ...base,
    id: "failed",
    at: 300,
    type: "failed",
    error: "ECONNRESET",
  })
  expect(requestDiagnostics(failed, retry)).toBe(failed)
  expect(requestDiagnostics(failed, { ...base, id: "failed", at: 300, type: "completed" })).toBe(failed)
})

test("a new message clears old errors and does not imply recovery", () => {
  const waiting = requestDiagnostics(requestDiagnostics([], start), retry)
  const fresh = requestDiagnostics(waiting, { ...start, id: "new", messageID: "new-message", at: 400 })
  expect(fresh[0]?.error).toBeUndefined()
  const done = requestDiagnostics(fresh, { ...base, id: "done", messageID: "new-message", at: 500, type: "completed" })
  expect(done[0]?.status).toBe("completed")
})

test("the trace is bounded and keeps only the most recent request for each chat", () => {
  const rows = Array.from({ length: 10 }, (_, index) => index).reduce<RequestDiagnostic[]>(
    (rows, index) =>
      requestDiagnostics(rows, { ...start, id: `event-${index}`, sessionID: `chat-${index}`, at: index }),
    [],
  )
  expect(rows).toHaveLength(8)
  expect(rows[0]?.sessionID).toBe("chat-9")
  const replaced = requestDiagnostics(rows, { ...start, id: "new", sessionID: "chat-5", at: 100 })
  expect(replaced).toHaveLength(8)
  expect(replaced.filter((row) => row.sessionID === "chat-5")).toHaveLength(1)
})

test("separate servers cannot overwrite matching session IDs and duration starts at first attempt", () => {
  const rows = requestDiagnostics(requestDiagnostics([], { ...start, serverKey: "a" }), { ...start, serverKey: "b" })
  expect(rows).toHaveLength(2)
  const waiting = requestDiagnostics(rows, { ...retry, serverKey: "a" })
  const done = requestDiagnostics(waiting, { ...base, id: "done", type: "completed", at: 900, serverKey: "a" })
  expect(done[0]).toMatchObject({ startedAt: 100, at: 900, status: "recovered" })
  expect(done[1]).toMatchObject({ serverKey: "b", status: "running" })
})
