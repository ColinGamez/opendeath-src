import { chromium } from "file:///C:/od/app/node_modules/.bun/playwright@1.60.0/node_modules/playwright/index.mjs"

const out = "C:/Users/Kylem/Documents/Qoder/2026-11-17/02a21507/analysis"
const browser = await chromium.connectOverCDP("http://127.0.0.1:9222")
const pages = browser.contexts().flatMap((context) => context.pages())
const page = pages.find((candidate) => candidate.url().includes("renderer")) ?? pages[0]
if (!page) throw new Error("no renderer page")
await page.bringToFront()

const clickText = (text) =>
  page.evaluate((wanted) => {
    const nodes = [...document.querySelectorAll("button")]
    const hit = nodes.find((node) => node.textContent?.trim() === wanted && node.getBoundingClientRect().width > 0)
    if (!hit) throw new Error(`button not found: ${wanted}`)
    hit.click()
    return true
  }, text)

// Close whatever the previous run left open.
await page.keyboard.press("Escape")
await page.waitForTimeout(400)

await clickText("Settings")
await page.waitForSelector('[data-component="dialog-v2"]', { timeout: 10000 })
await page.waitForTimeout(700)

const scroll = (top) =>
  page.evaluate((value) => {
    const body = document.querySelector('[data-slot="dialog-body"]')
    const scroller = body && [...body.querySelectorAll("div")].find((node) => getComputedStyle(node).overflowY === "auto")
    if (!scroller) throw new Error("no scroller")
    scroller.scrollTop = value === "end" ? scroller.scrollHeight : 0
    return { top: scroller.scrollTop, height: scroller.scrollHeight, client: scroller.clientHeight }
  }, top)

const shot = async (name) => {
  await page.waitForTimeout(450)
  await page.screenshot({ path: `${out}/${name}.png` })
  console.log("shot", name)
}

console.log("basic", await scroll("start"))
await shot("settings-10-basic-top")
console.log("basic-end", await scroll("end"))
await shot("settings-11-basic-end")

// Turn advanced mode on only if the Basic card still offers it.
const advancedOn = await page.evaluate(() => Boolean([...document.querySelectorAll("button")].find((node) => node.textContent?.trim() === "Show all options")))
if (advancedOn) {
  await clickText("Show all options")
  await page.waitForTimeout(500)
}

await clickText("Advanced")
await page.waitForTimeout(400)
console.log("advanced", await scroll("start"))
await shot("settings-12-advanced-top")
await shot("settings-13-advanced-bottom")

await clickText("Personalization")
await page.waitForTimeout(400)
await shot("settings-14-personalization-top")

// Light mode contrast check, then back to dark.
const light = page.getByRole("button", { name: "Light", exact: true })
if (await light.count()) {
  await light.first().click()
  await page.waitForTimeout(500)
  await shot("settings-15-personalization-light")
  await page.getByRole("button", { name: "Dark", exact: true }).first().click()
  await page.waitForTimeout(400)
}

await shot("settings-16-personalization-bottom")
console.log(
  JSON.stringify(
    await page.evaluate(() => {
      const container = document.querySelector('[data-slot="dialog-container"]')
      const rect = container?.getBoundingClientRect()
      return {
        width: rect && Math.round(rect.width),
        height: rect && Math.round(rect.height),
        scheme: document.documentElement.dataset.colorScheme,
      }
    }),
    null,
    2,
  ),
)

// Close check: the X must dismiss the dialog.
await page.locator('[data-slot="dialog-close-button"]').click()
await page.waitForTimeout(500)
console.log("dialog-after-close", await page.locator('[data-component="dialog-v2"]').count())
process.exit(0)
