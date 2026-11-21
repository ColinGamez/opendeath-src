import { describe, expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"

describe("upgrade command", () => {
  test("is registered in root help as a manual-update pointer", async () => {
    const root = await cli(["--help"])
    const help = await cli(["upgrade", "--help"])
    expect(root.exitCode).toBe(0)
    expect(root.stdout).toContain("upgrade")
    expect(help.exitCode).toBe(0)
    expect(help.stdout).not.toContain("--method")
  }, 60_000)

  test("prints the manual download and changes nothing", async () => {
    const result = await cli(["upgrade"])
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain("https://open.death.cl/download")
    expect(result.stdout.toLowerCase()).toContain("manual")
    expect(result.stdout).not.toContain("Upgrade complete")
  }, 60_000)
})

async function cli(args: string[], env: Record<string, string> = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), "opendeath-upgrade-"))
  try {
    const child = Bun.spawn([process.execPath, path.join(import.meta.dir, "../src/index.ts"), ...args], {
      cwd: path.join(import.meta.dir, ".."),
      env: {
        ...process.env,
        OPENCODE_TEST_HOME: root,
        XDG_DATA_HOME: path.join(root, "data"),
        XDG_CONFIG_HOME: path.join(root, "config"),
        XDG_CACHE_HOME: path.join(root, "cache"),
        XDG_STATE_HOME: path.join(root, "state"),
        OPENCODE_DISABLE_AUTOUPDATE: "1",
        ...env,
      },
      stdout: "pipe",
      stderr: "pipe",
    })
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ])
    expect(await Bun.file(path.join(root, "state", "opencode", "service-local.json")).exists()).toBe(false)
    return { stdout, stderr, exitCode }
  } finally {
    await rm(root, { recursive: true, force: true })
  }
}
