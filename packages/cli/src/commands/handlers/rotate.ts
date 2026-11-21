import { Effect } from "effect"
import { Commands } from "../commands"
import { Runtime } from "../../framework/runtime"
import { action, fail, printResult } from "./control"

const handler = Effect.fn("cli.rotate")(function* (input: Runtime.Input<typeof Commands.commands.rotate>) {
  const result = yield* Effect.tryPromise({
    try: () => action("/rotate", 200_000),
    catch: (error) => error,
  })
  printResult(result, input.json)
})

export default Runtime.handler(Commands.commands.rotate, (input) =>
  handler(input).pipe(Effect.catch((error) => Effect.sync(() => fail(error)))),
)
