import { chromium } from "file:///C:/od/app/node_modules/.bun/playwright@1.60.0/node_modules/playwright/index.mjs"

const out = "C:/Users/Kylem/Documents/Qoder/2026-11-17/02a21507/analysis"
const browser = await chromium.connectOverCDP("http://127.0.0.1:9222")
const pages = browser.contexts().flatMap((context) => context.pages())
const page = pages.find((candidate) => candidate.url().includes("renderer")) ?? pages[0]
if (!page) throw new Error("no renderer page")
await page.bringToFront()

const clickButton = (check) =>
  page.evaluate((kind) => {
    const hit = [...document.querySelectorAll("button")].find((node) => {
      const label = node.textContent?.replace(/\s+/g, " ").trim() ?? ""
      return node.getBoundingClientRect().width > 0 && (kind === "settings" ? label === "Settings" : kind === "advanced" ? label === "Show all options" : label.startsWith(kind))
    })
    if (!hit) throw new Error(`missing button ${kind}`)
    hit.click()
    return true
  }, check)

const clickTab = (prefix) =>
  page.evaluate((wanted) => {
    const hit = [...document.querySelectorAll('[role="tab"]')].find(
      (node) => node.textContent?.replace(/\s+/g, " ").trim().startsWith(wanted),
    )
    if (!hit) throw new Error(`missing tab ${wanted}`)
    hit.click()
    return true
  }, prefix)

const scrollerInfo = () =>
  page.evaluate(() => {
    const body = document.querySelector('[data-slot="dialog-body"]')
    const scroller = body && [...body.querySelectorAll("div")].find((node) => getComputedStyle(node).overflowY === "auto")
    if (!scroller) return null
    return { top: scroller.scrollTop, height: scroller.scrollHeight, client: scroller.clientHeight }
  })

const scrollTo = (where) =>
  page.evaluate((target) => {
    const body = document.querySelector('[data-slot="dialog-body"]')
    const scroller = body && [...body.querySelectorAll("div")].find((node) => getComputedStyle(node).overflowY === "auto")
    if (!scroller) return null
    scroller.scrollTop = target === "end" ? scroller.scrollHeight : 0
    return { top: scroller.scrollTop, height: scroller.scrollHeight, client: scroller.clientHeight }
  }, where)

const shot = async (name) => {
  await page.waitForTimeout(500)
  await page.screenshot({ path: `${out}/${name}.png` })
  console.log(name, JSON.stringify(await scrollerInfo()))
}

// Prove the solid default for the settings window; the key was never set in normal use.
await page.evaluate(() => localStorage.removeItem("infinite-dialog-opacity"))
await page.reload({ waitUntil: "domcontentloaded" })
await page.waitForTimeout(4200)

// Close anything the previous run left open, then land on a new session.
await page.keyboard.press("Escape")
await page.waitForTimeout(700)

await page.keyboard.press("Control+t")
await page.waitForSelector('[data-component="new-session"]', { timeout: 15000 })
await page.waitForTimeout(1200)
console.log("scheme", await page.evaluate(() => document.documentElement.dataset.colorScheme))
await shot("final-01-new-session")

await clickButton("settings")
await page.waitForFunction(() => Boolean(document.querySelector('[data-slot="dialog-container"]')), null, { timeout: 10000 })
await page.waitForTimeout(900)
const size = await page.evaluate(() => {
  const container = document.querySelector('[data-slot="dialog-container"]')
  const rect = container?.getBoundingClientRect()
  return rect
    ? {
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        alpha: getComputedStyle(container).getPropertyValue("--infinite-dialog-alpha"),
        storedOpacity: localStorage.getItem("infinite-dialog-opacity"),
      }
    : null
})
console.log("dialog-size", JSON.stringify(size))
await shot("final-02-settings-basic")

// Advanced mode persists from earlier runs; enable it only when the Basic card offers the toggle.
if (await page.getByRole("button", { name: "Show all options", exact: true }).count()) {
  await clickButton("advanced")
  await page.waitForTimeout(500)
}
await clickTab("Advanced")
await page.waitForTimeout(500)
await scrollTo("start")
await shot("final-03-settings-advanced")
await scrollTo("end")
await shot("final-04-settings-advanced-end")

await clickTab("Personalization")
await page.waitForTimeout(600)
await shot("final-05-settings-personalization")
await scrollTo("end")
await shot("final-06-settings-personalization-end")

// Light mode must stay readable; return to dark afterwards.
const light = page.getByRole("button", { name: "Light", exact: true })
if (await light.count()) {
  await light.first().click()
  await page.waitForTimeout(600)
  await page.screenshot({ path: `${out}/final-07-settings-light.png` })
  await page.getByRole("button", { name: "Dark", exact: true }).first().click()
  await page.waitForTimeout(500)
}

await page.keyboard.press("Escape")
await page.waitForTimeout(600)
console.log("dialog-after-escape", await page.locator('[data-component="dialog-v2"]').count())
await page.screenshot({ path: `${out}/final-08-settings-closed.png` })
process.exit(0)
