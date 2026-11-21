/**
 * The bridge between the OpenDeath terminal CLI and the running desktop app.
 *
 * The network deck lives in the Electron main process (WARP, proxies, the guarded reset and the connection doctor).
 * The CLI cannot import that code: it is a standalone binary and the deck needs the app's service. Instead the app
 * listens on loopback and writes a token file into its user-data directory. The CLI finds the newest file, checks
 * that the address is loopback, and calls the same actions the desktop buttons call.
 *
 * Nothing here imports Electron, so the TUI and the CLI can both use it.
 */

import { readFile, stat } from "node:fs/promises"
import { homedir } from "node:os"
import { join } from "node:path"

/** Packaged, beta and development identities, in the order a release build should prefer them. */
export const APP_IDS = ["dev.opendeath.desktop", "dev.opendeath.desktop.beta", "dev.opendeath.desktop.dev"] as const

export const CONTROL_FILE = "infinite-control.json"

export const MODES = ["WARP", "PROXY", "SOCKS", "ROUTE64", "MULLVAD", "WINDSCRIBE", "NONE"] as const
export type Mode = (typeof MODES)[number]

export type Result = { ok: boolean; message: string; ip?: string }

export type Status = {
  mode: Mode
  auto: boolean
  busy?: string
  waiting: number
  version?: string
}

export type Discovery = {
  /** Loopback base URL, for example http://127.0.0.1:52341 */
  url: string
  token: string
  pid?: number
  version?: string
  /** The file this record came from. */
  file: string
}

export function isMode(value: string): value is Mode {
  return (MODES as readonly string[]).includes(value)
}

/** The directories Electron uses for app data, one per identity. Overridable so the paths can be tested. */
export function controlDirectories(input?: {
  platform?: NodeJS.Platform
  env?: NodeJS.ProcessEnv
  home?: string
}): string[] {
  const platform = input?.platform ?? process.platform
  const env = input?.env ?? process.env
  const home = input?.home ?? homedir()
  let root: string
  if (platform === "win32") root = env.APPDATA || join(home, "AppData", "Roaming")
  else if (platform === "darwin") root = join(home, "Library", "Application Support")
  else root = env.XDG_CONFIG_HOME || join(home, ".config")
  return APP_IDS.map((id) => join(root, id))
}

export function controlFiles(input?: Parameters<typeof controlDirectories>[0]): string[] {
  return controlDirectories(input).map((directory) => join(directory, CONTROL_FILE))
}

function loopback(value: string): boolean {
  try {
    const url = new URL(value)
    if (url.protocol !== "http:") return false
    return url.hostname === "127.0.0.1" || url.hostname === "[::1]" || url.hostname === "::1"
  } catch {
    return false
  }
}

async function readDiscovery(file: string): Promise<Discovery | undefined> {
  try {
    const text = await readFile(file, "utf8")
    const value = JSON.parse(text) as Partial<Discovery>
    if (typeof value.url !== "string" || typeof value.token !== "string" || !value.token) return undefined
    if (!loopback(value.url)) return undefined
    return {
      url: value.url.replace(/\/+$/, ""),
      token: value.token,
      pid: typeof value.pid === "number" ? value.pid : undefined,
      version: typeof value.version === "string" ? value.version : undefined,
      file,
    }
  } catch {
    return undefined
  }
}

/** Every live-looking record, newest first. A stale file is skipped by the request fallback. */
export async function discoverControls(
  files: string[] = controlFiles(),
): Promise<Discovery[]> {
  const found: Array<{ discovery: Discovery; at: number }> = []
  for (const file of files) {
    const info = await stat(file).catch(() => undefined)
    if (!info?.isFile()) continue
    const discovery = await readDiscovery(file)
    if (discovery) found.push({ discovery, at: info.mtimeMs })
  }
  return found.sort((a, b) => b.at - a.at).map((item) => item.discovery)
}

export class ControlUnavailable extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ControlUnavailable"
  }
}

async function request<T>(
  discovery: Discovery,
  route: string,
  input: { method?: "GET" | "POST"; body?: unknown; timeoutMs?: number } = {},
): Promise<T> {
  const response = await fetch(discovery.url + route, {
    method: input.method ?? "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${discovery.token}`,
      ...(input.body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    ...(input.body === undefined ? {} : { body: JSON.stringify(input.body) }),
    signal: AbortSignal.timeout(input.timeoutMs ?? 15_000),
  })
  const text = await response.text()
  let payload: unknown
  try {
    payload = text ? JSON.parse(text) : undefined
  } catch {
    payload = undefined
  }
  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "message" in payload && typeof payload.message === "string"
        ? payload.message
        : `The desktop app answered ${response.status}.`
    throw new ControlUnavailable(message)
  }
  if (!payload || typeof payload !== "object") throw new ControlUnavailable("The desktop app sent no answer.")
  return payload as T
}

/**
 * Calls the running app, trying the newest identity first. A stale token file from a previous run is skipped.
 * Throws ControlUnavailable with a message the CLI can print verbatim.
 */
export async function callControl<T>(
  route: string,
  input: { method?: "GET" | "POST"; body?: unknown; timeoutMs?: number } = {},
): Promise<T> {
  const candidates = await discoverControls()
  if (candidates.length === 0) {
    throw new ControlUnavailable(
      "OpenDeath is not running. Start the desktop app, then run this command again: the network deck lives there.",
    )
  }
  let last: unknown
  for (const candidate of candidates) {
    try {
      return await request<T>(candidate, route, input)
    } catch (error) {
      last = error
    }
  }
  const message = last instanceof Error ? last.message : String(last)
  throw new ControlUnavailable(`OpenDeath is not answering on its control port (${message}). Restart the app and try again.`)
}
