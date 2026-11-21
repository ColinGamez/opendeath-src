import { intro, log, outro } from "@clack/prompts"
import { Effect } from "effect"
import { Commands } from "../commands"
import { Runtime } from "../../framework/runtime"
import { OPENCODE_VERSION } from "../../version"

/**
 * OpenDeath has no updater: no launch check, no background download, no feed and no restart prompt.
 * The command stays as a pointer so `opendeath upgrade` and `opendeath update` explain the manual path
 * instead of contacting an upstream feed.
 */
export default Runtime.handler(
  Commands.commands.upgrade,
  Effect.fn("cli.upgrade")(function* () {
    intro("Update OpenDeath")
    log.info(`Installed version: ${OPENCODE_VERSION}`)
    log.message("Updates are manual: OpenDeath never checks for, downloads, or installs one by itself.")
    log.message("Download the new build from https://open.death.cl/download and run the setup.")
    log.message("Installing it over this version keeps your settings and conversations.")
    outro("Nothing was changed")
  }),
)
