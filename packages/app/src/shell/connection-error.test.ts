import { expect, test } from "bun:test"
import { connectionError } from "./connection-error"

test.each([
  ["AI.Error.QuotaExceeded: Free usage limit reached", "quota"],
  ["subscription_sharing_usage_limit_exceeded", "quota"],
  ["provider.quota: rate limit exceeded", "quota"],
  ["429 Too many requests", "rate"],
  ["ECONNRESET: The socket connection was closed unexpectedly", "network"],
  ["ECONNREFUSED: Unable to connect", "network"],
  ["net::ERR_CONNECTION_TIMED_OUT", "network"],
  ["401 Unauthorized", "auth"],
  ["Connected", "unknown"],
  ["", "unknown"],
] as const)("diagnoses %s as %s", (message, expected) => {
  expect(connectionError(message)).toBe(expected)
})
