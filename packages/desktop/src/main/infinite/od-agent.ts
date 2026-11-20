import { mkdir, readFile, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import guide from "../../../../app/src/shell/open-death.md?raw"

// The hidden agent the Jailbreak toggle selects. Its body becomes the agent's system prompt, so the guide is present on
// every turn without ever being admitted as a chat message.
const HEADER = `---
description: OPEN.DEATH house guide
mode: primary
hidden: true
---

`

/** The config directory the bundled CLI reads: OPENCODE_CONFIG_DIR, else XDG_CONFIG_HOME/opencode, else ~/.config/opencode. */
export function odAgentFile() {
  const config =
    process.env.OPENCODE_CONFIG_DIR ??
    (process.env.XDG_CONFIG_HOME
      ? path.join(process.env.XDG_CONFIG_HOME, "opencode")
      : path.join(os.homedir(), ".config", "opencode"))
  return path.join(config, "agent", "od.md")
}

/**
 * Writes the hidden `od` agent next to the user's config, once per launch if its content changed. The config watcher
 * reloads agents on its own, so a running service picks it up too.
 */
export async function installOdAgent() {
  const file = odAgentFile()
  const body = HEADER + guide.replace(/^\uFEFF/, "").trimStart()
  try {
    const existing = await readFile(file, "utf8").catch(() => undefined)
    if (existing === body) return file
    await mkdir(path.dirname(file), { recursive: true })
    await writeFile(file, body, "utf8")
  } catch {
    // A read-only config directory leaves the toggle without its agent; the rest of the app still works.
  }
  return file
}
