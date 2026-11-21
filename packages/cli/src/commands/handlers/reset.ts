import { Effect } from "effect"
import { Commands } from "../commands"
import { Runtime } from "../../framework/runtime"
import { action, fail, printResult } from "./control"

const handler = Effect.fn("cli.reset")(function* (input: Runtime.Input<typeof Commands.commands.reset>) {
  const result = yield* Effect.tryPromise({
    try: () => action("/reset", 330_000),
    catch: (error) => error,
  })
  printResult(result, input.json)
})

export default Runtime.handler(Commands.commands.reset, (input) =>
  handler(input).pipe(Effect.catch((error) => Effect.sync(() => fail(error)))),
)
