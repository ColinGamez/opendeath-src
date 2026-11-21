/**
 * A loopback control port for the network deck.
 *
 * The desktop window and the terminal CLI are different processes. The buttons in the window go through Electron
 * IPC; the CLI cannot, so the same guarded actions are exposed here on 127.0.0.1. A random token is written to a
 * user-only file in the app's data directory, and every request must carry it. Browsers are refused outright: a
 * local page must not be able to click "reset" through the user's browser.
 */

import { randomBytes, timingSafeEqual } from "node:crypto"
import { mkdir, readFile, rm, writeFile } from "node:fs/promises"
import { createServer, type IncomingMessage, type ServerResponse } from "node:http"
import type { AddressInfo } from "node:net"
import { join } from "node:path"
import { CONTROL_FILE, MODES, type Mode, type Result, type Status } from "@opencode/util/opendeath-control"

export type ControlHandlers = {
  status(): Promise<Omit<Status, "version">>
  check(): Promise<Result>
  fix(): Promise<Result>
  reset(): Promise<Result>
  rotate(): Promise<Result>
  route(mode: Mode): Promise<Result>
}

export type ControlServer = {
  url: string
  token: string
  file: string
  close(): Promise<void>
}

const MAX_BODY = 64 * 1024

function json(response: ServerResponse, status: number, body: unknown) {
  const text = JSON.stringify(body)
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(text),
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  })
  response.end(text)
}

function authorized(request: IncomingMessage, token: string): boolean {
  const header = request.headers.authorization ?? ""
  const expected = `Bearer ${token}`
  const left = Buffer.from(header)
  const right = Buffer.from(expected)
  return left.length === right.length && timingSafeEqual(left, right)
}

async function body(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of request) {
    size += chunk.length
    if (size > MAX_BODY) throw new Error("Request body is too large.")
    chunks.push(chunk as Buffer)
  }
  if (chunks.length === 0) return undefined
  return JSON.parse(Buffer.concat(chunks).toString("utf8"))
}

function method(request: IncomingMessage): "GET" | "POST" | undefined {
  return request.method === "GET" || request.method === "POST" ? request.method : undefined
}

/** Starts the port and publishes the discovery file. Throws if the port cannot be opened or the file cannot be written. */
export async function startInfiniteControl(input: {
  directory: string
  version?: string
  handlers: ControlHandlers
}): Promise<ControlServer> {
  const token = randomBytes(32).toString("hex")
  const file = join(input.directory, CONTROL_FILE)

  // A stale record from a crashed run must never shadow this one.
  await rm(file, { force: true }).catch(() => undefined)
  await mkdir(input.directory, { recursive: true })

  const server = createServer((request, response) => {
    void (async () => {
      try {
        // Browsers send Origin on cross-origin and form posts. The CLI does not send one at all.
        if (request.headers.origin) return json(response, 403, { ok: false, message: "Browser requests are not allowed." })
        if (!authorized(request, token)) return json(response, 401, { ok: false, message: "Unauthorized." })

        const verb = method(request)
        if (!verb) return json(response, 405, { ok: false, message: "Method not allowed." })
        const url = new URL(request.url ?? "/", "http://127.0.0.1")

        if (verb === "GET" && url.pathname === "/status") {
          const status = await input.handlers.status()
          return json(response, 200, { ok: true, ...status, version: input.version })
        }
        if (verb !== "POST") return json(response, 404, { ok: false, message: "Unknown control route." })

        let result: Result
        if (url.pathname === "/check") result = await input.handlers.check()
        else if (url.pathname === "/fix") result = await input.handlers.fix()
        else if (url.pathname === "/reset") result = await input.handlers.reset()
        else if (url.pathname === "/rotate") result = await input.handlers.rotate()
        else if (url.pathname === "/route") {
          const value = (await body(request)) as { mode?: unknown } | undefined
          const mode = typeof value?.mode === "string" ? value.mode.toUpperCase() : ""
          if (!(MODES as readonly string[]).includes(mode))
            return json(response, 400, {
              ok: false,
              message: `Unknown route "${String(value?.mode ?? "")}". Use one of ${MODES.join(", ")}.`,
            })
          result = await input.handlers.route(mode as Mode)
        } else {
          return json(response, 404, { ok: false, message: "Unknown control route." })
        }
        return json(response, 200, result)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        if (!response.headersSent) json(response, 500, { ok: false, message })
        else response.end()
      }
    })()
  })

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject)
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject)
      resolve()
    })
  }).catch(async (error) => {
    server.close()
    throw error
  })

  const port = (server.address() as AddressInfo).port
  const url = `http://127.0.0.1:${port}`

  try {
    await writeFile(
      file,
      JSON.stringify({ url, token, pid: process.pid, ...(input.version ? { version: input.version } : {}) }),
      { mode: 0o600 },
    )
  } catch (error) {
    server.close()
    throw error
  }

  return {
    url,
    token,
    file,
    close: async () => {
      server.closeAllConnections?.()
      await new Promise<void>((resolve) => server.close(() => resolve()))
      // Only remove the record this process wrote; never a newer instance's file.
      const current = await readFile(file, "utf8").catch(() => "")
      try {
        if ((JSON.parse(current) as { token?: string }).token === token) await rm(file, { force: true })
      } catch {
        /* an unreadable file is left alone */
      }
    },
  }
}
