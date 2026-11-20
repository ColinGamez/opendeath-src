import { beforeEach, describe, expect, test } from "bun:test"

// happy-dom provides localStorage (see happydom.ts in the preload); the store reads it at module load,
// so each case imports a fresh copy of the module to re-read whatever the previous case stored.
const KEY = "opencode.infinite.hud"

type Module = typeof import("./hud-layout")

async function fresh(): Promise<Module> {
  return (await import(`./hud-layout.ts?fresh=${Math.random()}`)) as Module
}

describe("hud layout", () => {
  beforeEach(() => localStorage.clear())

  test("starts with every slot in registry order and nothing hidden", async () => {
    const hud = await fresh()
    expect(hud.hudLayout().order).toEqual([...hud.HUD_ITEMS])
    expect(hud.hudLayout().hidden).toEqual([])
    expect(hud.visibleItems()).toEqual([...hud.HUD_ITEMS])
  })

  test("keeps a saved order and appends items added by a later build", async () => {
    localStorage.setItem(KEY, JSON.stringify({ order: ["readout", "settings"], hidden: ["brand"] }))
    const hud = await fresh()
    const order = hud.hudLayout().order
    expect(order[0]).toBe("readout")
    expect(order[1]).toBe("settings")
    // Everything the saved order did not mention follows in registry order, exactly once.
    expect(new Set(order).size).toBe(hud.HUD_ITEMS.length)
    expect(new Set(order)).toEqual(new Set(hud.HUD_ITEMS))
  })

  test("drops ids this build no longer ships", async () => {
    localStorage.setItem(KEY, JSON.stringify({ order: ["gone", "status"], hidden: ["also-gone"] }))
    const hud = await fresh()
    expect(hud.hudLayout().order).not.toContain("gone" as never)
    expect(hud.hudLayout().hidden).toEqual([])
    expect(hud.hudLayout().order[0]).toBe("status")
  })

  test("survives a corrupt entry", async () => {
    localStorage.setItem(KEY, "{not json")
    const hud = await fresh()
    expect(hud.hudLayout().order).toEqual([...hud.HUD_ITEMS])
  })

  test("moves an item to an exact index", async () => {
    const hud = await fresh()
    hud.moveItem("settings", 0)
    expect(hud.hudLayout().order[0]).toBe("settings")
    hud.moveItem("settings", 3)
    expect(hud.hudLayout().order[3]).toBe("settings")
  })

  test("a visible-only move lands where the eye saw it", async () => {
    const hud = await fresh()
    hud.setHidden("fix", true)
    hud.setHidden("status", true)
    const shown = hud.visibleItems()
    // Drag the last shown item onto the first shown slot.
    hud.moveItem(shown[shown.length - 1]!, 0, true)
    expect(hud.visibleItems()[0]).toBe(shown[shown.length - 1])
    // The hidden slots are still hidden, and nothing was lost.
    expect(hud.hudLayout().hidden.sort()).toEqual(["fix", "status"])
    expect(hud.hudLayout().order.length).toBe(hud.HUD_ITEMS.length)
  })

  test("hiding keeps the slot, so showing it again restores the place", async () => {
    const hud = await fresh()
    const before = hud.hudLayout().order.indexOf("resetLimit")
    hud.setHidden("resetLimit", true)
    expect(hud.hudLayout().order.indexOf("resetLimit")).toBe(before)
    expect(hud.visibleItems()).not.toContain("resetLimit")
    hud.setHidden("resetLimit", false)
    expect(hud.hudLayout().order.indexOf("resetLimit")).toBe(before)
  })

  test("reset returns the shipped layout", async () => {
    const hud = await fresh()
    hud.moveItem("settings", 0)
    hud.setHidden("brand", true)
    hud.resetHud()
    expect(hud.hudLayout().order).toEqual([...hud.HUD_ITEMS])
    expect(hud.hudLayout().hidden).toEqual([])
  })

  test("writes every change through to storage", async () => {
    const hud = await fresh()
    hud.moveItem("settings", 0)
    hud.setHidden("readout", true)
    const saved = JSON.parse(localStorage.getItem(KEY) ?? "{}") as { order: string[]; hidden: string[] }
    expect(saved.order[0]).toBe("settings")
    expect(saved.hidden).toEqual(["readout"])
  })
})
