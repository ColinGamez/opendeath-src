import { EOL } from "node:os"
import { Effect, Option } from "effect"
import { callControl, isMode, MODES, type Result, type Status } from "@opencode/util/opendeath-control"
import { Commands } from "../commands"
import { Runtime } from "../../framework/runtime"
import { fail, printResult } from "./control"

const handler = Effect.fn("cli.route")(function* (input: Runtime.Input<typeof Commands.commands.route>) {
  const requested = Option.getOrUndefined(input.mode)?.trim()
  if (!requested || !requested.length) {
    const status = yield* Effect.tryPromise({
      try: () => callControl<Status>("/status", { timeoutMs: 15_000 }),
      catch: (error) => error,
    })
    if (input.json) {
      process.stdout.write(JSON.stringify(status) + EOL)
      return
    }
    process.stdout.write(`Route: ${status.mode}${EOL}`)
    process.stdout.write(`Available: ${MODES.join(", ")}${EOL}`)
    return
  }

  const mode = requested.toUpperCase() === "DIRECT" ? "NONE" : requested.toUpperCase()
  if (mode === "AUTO") {
    process.stderr.write("Auto is a flow, not a saved route. Run `opendeath fix` to let it choose.\n")
    process.exitCode = 1
    return
  }
  if (!isMode(mode)) {
    process.stderr.write(`Unknown route "${requested}". Use one of ${MODES.join(", ")}.\n`)
    process.exitCode = 1
    return
  }

  const result = yield* Effect.tryPromise({
    try: () =>
      callControl<Result>("/route", {
        method: "POST",
        body: { mode },
        timeoutMs: 200_000,
      }),
    catch: (error) => error,
  })
  printResult(result, input.json)
})

export default Runtime.handler(Commands.commands.route, (input) =>
  handler(input).pipe(Effect.catch((error) => Effect.sync(() => fail(error)))),
)
