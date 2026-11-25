export type RequestEvent = {
  id: string
  sessionID: string
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
  messageID: string
  at: number
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
  const previous = rows.find((row) => row.sessionID === event.sessionID)
  if (previous && (previous.id === event.id || previous.at > event.at)) return rows
  const same = previous?.messageID === event.messageID ? previous : undefined
  const base = {
    ...same,
    id: event.id,
    sessionID: event.sessionID,
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
  return [next, ...rows.filter((row) => row.sessionID !== event.sessionID)].slice(0, 8)
}
