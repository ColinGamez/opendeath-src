import { EOL } from "node:os"
import { callControl, type Result } from "@opencode/util/opendeath-control"

/** Runs one of the desktop actions and returns its result. */
export function action(route: string, timeoutMs: number): Promise<Result> {
  return callControl<Result>(route, { method: "POST", timeoutMs })
}

/** Prints an action result once, and sets the exit code when the desktop reports a failure. */
export function printResult(result: Result, json: boolean) {
  if (json) {
    process.stdout.write(JSON.stringify(result) + EOL)
  } else {
    process.stdout.write(result.message + EOL)
    if (result.ip) process.stdout.write(`IP: ${result.ip}${EOL}`)
  }
  if (!result.ok) process.exitCode = 1
}

/** A failed call (the app is not running, the token is stale, the port is closed) is a normal CLI error. */
export function fail(error: unknown) {
  process.stderr.write((error instanceof Error ? error.message : String(error)) + EOL)
  process.exitCode = 1
}
