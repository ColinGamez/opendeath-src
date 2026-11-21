import { Effect } from "effect"
import { Commands } from "../commands"
import { Runtime } from "../../framework/runtime"
import { action, fail, printResult } from "./control"

const handler = Effect.fn("cli.fix")(function* (input: Runtime.Input<typeof Commands.commands.fix>) {
  const result = yield* Effect.tryPromise({
    try: () => action("/fix", 600_000),
    catch: (error) => error,
  })
  printResult(result, input.json)
})

export default Runtime.handler(Commands.commands.fix, (input) =>
  handler(input).pipe(Effect.catch((error) => Effect.sync(() => fail(error)))),
)
