import { afterEach, describe, expect, test } from "bun:test"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { callControl, controlFiles, discoverControls, isMode, MODES } from "./opendeath-control.js"

const directories: string[] = []

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })))
})

async function directory() {
  const root = await mkdtemp(join(tmpdir(), "opendeath-discover-"))
  directories.push(root)
  return root
}

describe("opendeath control discovery", () => {
  test("builds one record path per app identity", () => {
    const files = controlFiles({ platform: "linux", env: { XDG_CONFIG_HOME: "/home/x/.config" } as NodeJS.ProcessEnv, home: "/home/x" })
    expect(files).toHaveLength(3)
    expect(files[0]).toBe(join("/home/x/.config", "dev.opendeath.desktop", "infinite-control.json"))
    const windows = controlFiles({ platform: "win32", env: { APPDATA: "C:/Users/x/AppData/Roaming" } as NodeJS.ProcessEnv })
    expect(windows[2]).toBe(join("C:/Users/x/AppData/Roaming", "dev.opendeath.desktop.dev", "infinite-control.json"))
  })

  test("reads only loopback records with a token, newest first", async () => {
    const root = await directory()
    const old = join(root, "a.json")
    const fresh = join(root, "b.json")
    await writeFile(old, JSON.stringify({ url: "http://127.0.0.1:1111", token: "one" }))
    await new Promise((resolve) => setTimeout(resolve, 20))
    await writeFile(fresh, JSON.stringify({ url: "http://127.0.0.1:2222/", token: "two" }))
    const found = await discoverControls([old, fresh])
    expect(found.map((item) => item.token)).toEqual(["two", "one"])
    expect(found[0]?.url).toBe("http://127.0.0.1:2222")
  })

  test("rejects a remote address, a missing token and broken json", async () => {
    const root = await directory()
    const remote = join(root, "remote.json")
    const tokenless = join(root, "tokenless.json")
    const broken = join(root, "broken.json")
    await writeFile(remote, JSON.stringify({ url: "http://10.0.0.5:80", token: "x" }))
    await writeFile(tokenless, JSON.stringify({ url: "http://127.0.0.1:9", token: "" }))
    await writeFile(broken, "{")
    expect(await discoverControls([remote, tokenless, broken])).toEqual([])
  })

  test("reports a missing app once, not a crash", async () => {
    const root = await directory()
    const missing = join(root, "none.json")
    expect(await discoverControls([missing])).toEqual([])
  })

  test("knows the route names", () => {
    expect(MODES.every(isMode)).toBe(true)
    expect(isMode("tor")).toBe(false)
    expect(MODES).toContain("NONE")
  })

  test("callControl refuses without a running app", async () => {
    // No control file exists on a clean machine; the error must name the fix.
    const error = await callControl("/status").catch((cause: unknown) => cause)
    expect(error).toBeInstanceOf(Error)
  })
})
