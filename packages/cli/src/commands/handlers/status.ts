import { EOL } from "node:os"
import { Effect } from "effect"
import { callControl, type Result, type Status } from "@opencode/util/opendeath-control"
import { Commands } from "../commands"
import { Runtime } from "../../framework/runtime"
import { fail } from "./control"

const handler = Effect.fn("cli.status")(function* (input: Runtime.Input<typeof Commands.commands.status>) {
  const status = yield* Effect.tryPromise({
    try: () => callControl<Status>("/status", { timeoutMs: 15_000 }),
    catch: (error) => error,
  })
  if (input.json) {
    process.stdout.write(JSON.stringify(status) + EOL)
    return
  }
  const lines = [
    ...(status.version ? [`OpenDeath ${status.version}`] : []),
    `Route: ${status.mode}`,
    `Auto-rotate: ${status.auto ? "on" : "off"}`,
    `Waiting chats: ${status.waiting}`,
    `Busy: ${status.busy ?? "idle"}`,
  ]
  if (input.check) {
    const checked = yield* Effect.tryPromise({
      try: () => callControl<Result>("/check", { method: "POST", timeoutMs: 30_000 }),
      catch: (error) => error,
    })
    const label = checked.message?.trim() || (checked.ok ? "OK" : "failed")
    lines.push(`Check: ${label}${checked.ip ? ` (${checked.ip})` : ""}`)
    if (!checked.ok) process.exitCode = 1
  }
  process.stdout.write(lines.join(EOL) + EOL)
})

export default Runtime.handler(Commands.commands.status, (input) =>
  handler(input).pipe(Effect.catch((error) => Effect.sync(() => fail(error)))),
)
