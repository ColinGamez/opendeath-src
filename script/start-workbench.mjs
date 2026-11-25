import { spawn } from "node:child_process"
import { copyFileSync, existsSync, mkdirSync } from "node:fs"
import { createRequire } from "node:module"
import { homedir } from "node:os"
import path from "node:path"

const desktop = path.resolve(import.meta.dirname, "../packages/desktop")
const require = createRequire(path.join(desktop, "package.json"))
const electron = require("electron")
const profile = path.join(process.env.LOCALAPPDATA ?? homedir(), "OpenDeath-Workbench")

if (!existsSync(path.join(desktop, "out/main/index.js"))) {
  throw new Error("Build the development desktop before launching the workbench.")
}
const cli = path.join(desktop, "resources/opencode-cli.exe")
if (!existsSync(cli)) throw new Error("Build and bundle the Windows CLI before launching the workbench.")
copyFileSync(cli, path.join(desktop, "resources/opencode-cli-dev.exe"))
mkdirSync(profile, { recursive: true })
const environment = {
  ...process.env,
  OPENCODE_DESKTOP_TEST_ROOT: profile,
  OPENCODE_CONFIG_DIR: path.join(profile, "config/opencode"),
  OPENCODE_DB: path.join(profile, "opencode.db"),
  OPENCODE_DESKTOP_CLI_DEV: "",
  OPENCODE_DESKTOP_ISOLATED_SERVER: "1",
  OPENCODE_DISABLE_CHANNEL_DB: "0",
}
// Coding tools may inherit Electron's Node mode; the workbench needs its desktop runtime.
delete environment.ELECTRON_RUN_AS_NODE

const child = spawn(electron, [desktop], {
  cwd: desktop,
  detached: true,
  stdio: "ignore",
  windowsHide: true,
  env: environment,
})
child.on("error", (error) => {
  console.error(error.message)
  process.exitCode = 1
})
child.unref()
console.log(`OpenDeath Workbench profile: ${profile}`)
