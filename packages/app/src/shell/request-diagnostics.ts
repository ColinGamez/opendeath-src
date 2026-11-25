import { Schema } from "effect"
import { Persistence } from "@/runtime/persistence/schema"

export type RequestEvent = {
  id: string
  sessionID: string
  serverKey?: string
  messageID: string
  at: number
} & (
  | { type: "started"; model: string; provider: string }
  | { type: "retrying"; error: string; attempt: number; retryAt: number; resetAt?: number }
  | { type: "failed"; error: string; resetAt?: number }
  | { type: "completed" }
)

export type RequestDiagnostic = {
  id: string
  sessionID: string
  serverKey?: string
  messageID: string
  at: number
  startedAt?: number
  saved?: boolean
  model?: string
  provider?: string
  error?: string
  attempt?: number
  retryAt?: number
  resetAt?: number
  status: "running" | "retrying" | "failed" | "recovered" | "completed"
}

/** Keep recent outcomes in memory; never let a reconnect replay overwrite newer evidence. */
export function requestDiagnostics(rows: RequestDiagnostic[], event: RequestEvent): RequestDiagnostic[] {
  const previous = rows.find((row) => row.sessionID === event.sessionID && row.serverKey === event.serverKey)
  if (previous && (previous.id === event.id || previous.at > event.at)) return rows
  const same = previous?.messageID === event.messageID ? previous : undefined
  const base = {
    ...same,
    id: event.id,
    sessionID: event.sessionID,
    serverKey: event.serverKey,
    startedAt: same?.startedAt ?? (event.type === "started" ? event.at : undefined),
    messageID: event.messageID,
    at: event.at,
  }
  const next: RequestDiagnostic =
    event.type === "started"
      ? { ...base, status: "running", model: event.model, provider: event.provider }
      : event.type === "completed"
        ? { ...base, status: same?.error ? "recovered" : "completed", retryAt: undefined, resetAt: undefined }
        : {
            ...base,
            status: event.type,
            error: event.error,
            resetAt: event.resetAt,
            retryAt: event.type === "retrying" ? event.retryAt : undefined,
            attempt: event.type === "retrying" ? event.attempt : same?.attempt,
          }
  return [next, ...rows.filter((row) => row.sessionID !== event.sessionID || row.serverKey !== event.serverKey)].slice(
    0,
    8,
  )
}

export const requestHistorySchema = Persistence.struct({
  rows: Schema.Array(
    Persistence.struct({
      id: Schema.String,
      sessionID: Schema.String,
      serverKey: Persistence.optional(Schema.String),
      messageID: Schema.String,
      at: Schema.Number,
      startedAt: Persistence.optional(Schema.Number),
      model: Persistence.optional(Schema.String),
      provider: Persistence.optional(Schema.String),
      error: Persistence.optional(Schema.String),
      attempt: Persistence.optional(Schema.Number),
      retryAt: Persistence.optional(Schema.Number),
      resetAt: Persistence.optional(Schema.Number),
      status: Schema.Literals(["running", "retrying", "failed", "recovered", "completed"]),
    }),
  ),
})
