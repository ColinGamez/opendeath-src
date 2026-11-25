import { expect, test } from "bun:test"
import { fixConnection } from "./infinite-doctor"
import type { Platform } from "@/runtime/platform/platform"

type Infinite = NonNullable<Platform["infinite"]>

// A computer described by what it has; setMode answers ok only for the modes in `works`, and every call is recorded.
function computer(input: { mode?: string; warp?: boolean; socks?: string; custom?: string; works: string[]; direct?: boolean }) {
  const tried: string[] = []
  const infinite = {
    getMode: async () => input.mode ?? "NONE",
    checkIp: async () => (input.direct ? { ok: true, ip: "1.1.1.1", message: "" } : { ok: false, message: "down" }),
    getOptions: async () => ({ socks: input.socks ?? "", custom: input.custom ?? "" }),
    route64Status: async () => ({ imported: false, up: false }),
    toolPlan: async () => ({ installed: input.warp === true }),
    setMode: async (mode: string) => {
      tried.push(mode)
      return input.works.includes(mode) ? { ok: true, message: "ok", ip: "9.9.9.9" } : { ok: false, message: "no" }
    },
  } as unknown as Infinite
  return { infinite, tried }
}

test("an already working connection is left alone", async () => {
  const pc = computer({ mode: "WARP", direct: true, works: [] })
  const outcome = await fixConnection(pc.infinite, () => undefined)
  expect(outcome).toMatchObject({ ok: true, mode: "WARP", ip: "1.1.1.1" })
  expect(pc.tried).toEqual([])
})

test("Direct is retried before switching a previously selected Direct connection", async () => {
  const pc = computer({ mode: "NONE", warp: true, works: ["NONE", "WARP"] })
  expect((await fixConnection(pc.infinite, () => undefined)).mode).toBe("NONE")
  expect(pc.tried).toEqual(["NONE"])
})

test("from scratch: WARP first, then direct as the last resort", async () => {
  const warp = computer({ warp: true, works: ["WARP"] })
  expect((await fixConnection(warp.infinite, () => undefined, true)).mode).toBe("WARP")

  const bad = computer({ warp: true, works: ["NONE"] })
  expect((await fixConnection(bad.infinite, () => undefined, true)).mode).toBe("NONE")
  expect(bad.tried).toEqual(["WARP", "NONE"])
})

test("from scratch without WARP stops at the requirement instead of falling back", async () => {
  const noWarp = computer({ warp: false, works: [] })
  const outcome = await fixConnection(noWarp.infinite, () => undefined, true)
  expect(outcome.ok).toBe(false)
  expect(outcome.message).toContain("WARP is required")
  expect(noWarp.tried).toEqual([])
})

test("a dead current mode is retried first, and the user's own lists come before a direct fallback", async () => {
  const pc = computer({ mode: "SOCKS", socks: "h:1", custom: "p:1", warp: true, works: ["PROXY"] })
  const outcome = await fixConnection(pc.infinite, () => undefined)
  expect(outcome).toMatchObject({ ok: true, mode: "PROXY" })
  expect(pc.tried).toEqual(["SOCKS", "WARP", "PROXY"])
})

test("when nothing connects, the outcome says why", async () => {
  const pc = computer({ warp: true, works: [] })
  const outcome = await fixConnection(pc.infinite, () => undefined, true)
  expect(outcome.ok).toBe(false)
  expect(outcome.message).toContain("WARP: no")
})
