import { execFile } from "node:child_process"
import { accessSync, constants } from "node:fs"
import { stat } from "node:fs/promises"
import path from "node:path"

// Mullvad and Windscribe are used through their own command-line tools. The app never installs them and never
// stores an account: the user logs in once in the client, and this only switches the server.

export type Client = "MULLVAD" | "WINDSCRIBE"
type Output = { ok: boolean; out: string }
export type Runner = (exe: string, args: string[], timeout?: number) => Promise<Output>

const exes: Record<Client, string> =
  process.platform === "win32"
    ? {
        MULLVAD: "C:\\Program Files\\Mullvad VPN\\resources\\mullvad.exe",
        WINDSCRIBE: "C:\\Program Files\\Windscribe\\windscribe-cli.exe",
      }
    : {
        // Both clients install a command-line tool on Linux and macOS; Mullvad's is `mullvad`, Windscribe's is
        // `windscribe-cli`. The app never installs them, so a missing one is reported, not downloaded.
        MULLVAD: "/usr/bin/mullvad",
        WINDSCRIBE: "/usr/bin/windscribe-cli",
      }
const names: Record<Client, string> = { MULLVAD: "Mullvad", WINDSCRIBE: "Windscribe" }
// Mullvad country codes used when the user gives no locations.
const MULLVAD_DEFAULT = ["se", "de", "nl", "ch", "no", "fi", "ro", "at"]

const real: Runner = (exe, args, timeout = 60_000) =>
  new Promise((resolve) =>
    execFile(exe, args, { timeout, windowsHide: true }, (error, stdout, stderr) =>
      resolve({ ok: !error, out: `${stdout}${stderr}` }),
    ),
  )
let runner: Runner = real
/** Tests replace the runner so no client is needed. */
export function setRunner(next: Runner | undefined) {
  runner = next ?? real
}

export const clientName = (client: Client) => names[client]

/** True when the executable is found under one of the PATH entries (distro packages do not always use /usr/bin). */
function onPath(file: string) {
  return (process.env.PATH ?? "").split(path.delimiter).some((dir) => {
    if (!dir) return false
    try {
      accessSync(path.join(dir, file), constants.X_OK)
      return true
    } catch {
      return false
    }
  })
}

export async function installed(client: Client) {
  return stat(exes[client]).then(
    () => true,
    () => process.platform !== "win32" && onPath(path.basename(exes[client])),
  )
}

/** The next location to use: from the user's list (or Mullvad's default codes), never the one in use. */
export function pickLocation(client: Client, locations: string[], current?: string): string | undefined {
  const pool = locations.length ? locations : client === "MULLVAD" ? MULLVAD_DEFAULT : []
  const others = pool.filter((item) => item !== current)
  const list = others.length ? others : pool
  return list.length ? list[Math.floor(Math.random() * list.length)] : undefined
}

export async function connectClient(client: Client, location?: string): Promise<{ ok: boolean; message: string }> {
  const name = names[client]
  if (!(await installed(client))) return { ok: false, message: `${name} is not installed.` }
  if (client === "MULLVAD") {
    if (location) {
      const set = await runner(exes.MULLVAD, ["relay", "set", "location", location])
      if (!set.ok) return { ok: false, message: `Mullvad refused ${location}: ${set.out.trim() || "unknown error"}` }
    }
    const up = await runner(exes.MULLVAD, ["connect", "--wait"], 90_000)
    return up.ok
      ? { ok: true, message: `Mullvad connected${location ? ` (${location})` : ""}` }
      : { ok: false, message: `Mullvad did not connect: ${up.out.trim() || "unknown error"}` }
  }
  const target = location ?? "best"
  const up = await runner(exes.WINDSCRIBE, ["connect", target], 90_000)
  return up.ok
    ? { ok: true, message: `Windscribe connected (${target})` }
    : { ok: false, message: `Windscribe did not connect: ${up.out.trim() || "unknown error"}` }
}

export async function disconnectClient(client: Client): Promise<{ ok: boolean; message: string }> {
  if (!(await installed(client))) return { ok: true, message: `${names[client]} is not installed; nothing to disconnect.` }
  const exe = exes[client]
  const down = await runner(exe, ["disconnect"], 60_000)
  return down.ok ? { ok: true, message: `${names[client]} disconnected.` } : { ok: false, message: `${names[client]} did not disconnect.` }
}
