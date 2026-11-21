import { afterEach, describe, expect, test } from "bun:test"
import { mkdtemp, readFile, rm, stat } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { CONTROL_FILE, callControl, type Mode, type Result, type Status } from "@opencode/util/opendeath-control"
import { startInfiniteControl, type ControlServer } from "./control"

const servers: ControlServer[] = []
const roots: string[] = []

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()))
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

async function start(
  overrides: Partial<Parameters<typeof startInfiniteControl>[0]["handlers"]> = {},
  directory?: string,
) {
  const target = directory ?? (await mkdtemp(join(tmpdir(), "opendeath-control-")))
  roots.push(target)
  const server = await startInfiniteControl({
    directory: target,
    version: "1.0.4",
    handlers: {
      status: async () => ({ mode: "WARP", auto: true, busy: undefined, waiting: 0 }),
      check: async () => ({ ok: true, message: "WARP works", ip: "203.0.113.9" }),
      fix: async () => ({ ok: true, message: "WARP works" }),
      reset: async () => ({ ok: true, message: "Session reset" }),
      rotate: async () => ({ ok: true, message: "New IP" }),
      route: async (mode: Mode) => ({ ok: true, message: `Switched to ${mode}` }),
      ...overrides,
    },
  })
  servers.push(server)
  return { directory: target, server, file: join(target, CONTROL_FILE) }
}

function call(server: ControlServer, path: string, init: RequestInit = {}) {
  return fetch(server.url + path, {
    ...init,
    headers: { Authorization: `Bearer ${server.token}`, ...(init.headers ?? {}) },
  })
}

describe("infinite control", () => {
  test("publishes a token file and answers status", async () => {
    const { server, file } = await start()
    const record = JSON.parse(await readFile(file, "utf8"))
    expect(record.url).toBe(server.url)
    expect(record.token).toBe(server.token)
    expect(record.version).toBe("1.0.4")
    expect(record.pid).toBe(process.pid)

    const response = await call(server, "/status")
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ ok: true, mode: "WARP", auto: true, waiting: 0, version: "1.0.4" })
  })

  test("refuses a missing token and browser origins", async () => {
    const { server } = await start()
    expect((await fetch(server.url + "/status")).status).toBe(401)
    expect((await call(server, "/status", { headers: { Origin: "https://evil.example" } })).status).toBe(403)
  })

  test("runs the desktop actions", async () => {
    const { server } = await start()
    const fixed = (await (await call(server, "/fix", { method: "POST" })).json()) as Result
    expect(fixed).toEqual({ ok: true, message: "WARP works" })

    const reset = (await (await call(server, "/reset", { method: "POST" })).json()) as Result
    expect(reset.ok).toBe(true)

    const rotated = (await (await call(server, "/rotate", { method: "POST" })).json()) as Result
    expect(rotated.ok).toBe(true)
  })

  test("switches routes and rejects an unknown one", async () => {
    const { server } = await start()
    const response = await call(server, "/route", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "proxy" }),
    })
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ ok: true, message: "Switched to PROXY" })

    const bad = await call(server, "/route", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "tor" }),
    })
    expect(bad.status).toBe(400)
    expect(((await bad.json()) as Result).message).toContain("Unknown route")
  })

  test("removes its record on close", async () => {
    const { server, file } = await start()
    expect((await stat(file)).isFile()).toBe(true)
    await server.close()
    expect(await stat(file).catch(() => undefined)).toBeUndefined()
  })

  test("the CLI finds the app through its user-data record", async () => {
    // The CLI walks the platform's app-data roots. Point that root at the test directory so the record this server
    // published is exactly the one discovery reads, as it would on a real machine.
    const root = await mkdtemp(join(tmpdir(), "opendeath-root-"))
    const key = process.platform === "win32" ? "APPDATA" : "XDG_CONFIG_HOME"
    const previous = process.env[key]
    process.env[key] = root
    try {
      await start({}, join(root, "dev.opendeath.desktop"))
      const status = await callControl<Status>("/status")
      expect(status).toMatchObject({ ok: true, mode: "WARP", auto: true, waiting: 0 })
      const fixed = await callControl<Result>("/fix", { method: "POST" })
      expect(fixed).toEqual({ ok: true, message: "WARP works" })
    } finally {
      if (previous === undefined) delete process.env[key]
      else process.env[key] = previous
      await rm(root, { recursive: true, force: true })
    }
  })
})
