import { chromium } from "file:///C:/od/app/node_modules/.bun/playwright@1.60.0/node_modules/playwright/index.mjs"

const out = "C:/Users/Kylem/Documents/Qoder/2026-11-17/02a21507/analysis"
const browser = await chromium.connectOverCDP("http://127.0.0.1:9222")
const pages = browser.contexts().flatMap((context) => context.pages())
const page = pages.find((candidate) => candidate.url().includes("renderer")) ?? pages[0]
await page.bringToFront()

const selected = () =>
  page.evaluate(() => {
    const tab = document.querySelector('[role="tab"][aria-selected="true"]')
    return tab?.textContent?.replace(/\s+/g, " ").trim() ?? null
  })

const shot = async (name) => {
  await page.waitForTimeout(1600)
  console.log(name, "selected=", JSON.stringify(await selected()))
  await page.screenshot({ path: `${out}/${name}.png` })
}

// Start from the current window, close any leftover overlay first.
await page.keyboard.press("Escape")
await page.waitForTimeout(600)

await page.getByRole("button", { name: "Settings", exact: true }).first().click()
await page.waitForSelector('[data-slot="dialog-container"]', { timeout: 10000 })
await shot("check-01-open")

await page.locator('[role="tab"]').filter({ hasText: "Advanced" }).first().click()
await shot("check-02-advanced")

await page.locator('[role="tab"]').filter({ hasText: "Personalization" }).first().click()
await shot("check-03-personalization")

await page.locator('[role="tab"]').filter({ hasText: "Basic" }).first().click()
await shot("check-04-basic")

console.log(
  JSON.stringify(
    await page.evaluate(() => {
      const container = document.querySelector('[data-slot="dialog-container"]')
      const scroller = document.querySelector('[data-slot="dialog-body"] .overflow-y-auto')
      return {
        alpha: container && getComputedStyle(container).getPropertyValue("--infinite-dialog-alpha"),
        scrollerTop: scroller?.scrollTop,
        scheme: document.documentElement.dataset.colorScheme,
      }
    }),
    null,
    2,
  ),
)

await page.keyboard.press("Escape")
await page.waitForTimeout(600)
console.log("closed", await page.locator('[data-component="dialog-v2"]').count())
process.exit(0)
