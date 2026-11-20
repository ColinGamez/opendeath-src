import { chromium } from "file:///C:/od/app/node_modules/.bun/playwright@1.60.0/node_modules/playwright/index.mjs"

const out = "C:/Users/Kylem/Documents/Qoder/2026-11-17/02a21507/analysis"
const browser = await chromium.connectOverCDP("http://127.0.0.1:9222")
const pages = browser.contexts().flatMap((context) => context.pages())
const page = pages.find((candidate) => candidate.url().includes("renderer")) ?? pages[0]
if (!page) throw new Error("no renderer page")
await page.bringToFront()

// Prove the first-run default: no stored scheme, reload, and read what the theme chose.
const stored = await page.evaluate(() => localStorage.getItem("opencode-color-scheme"))
await page.evaluate(() => localStorage.removeItem("opencode-color-scheme"))
await page.reload({ waitUntil: "domcontentloaded" })
await page.waitForTimeout(4500)
const scheme = await page.evaluate(() => document.documentElement.dataset.colorScheme)
console.log(JSON.stringify({ stored, scheme }, null, 2))

await page.keyboard.press("Control+t")
await page.waitForTimeout(1200)
await page.screenshot({ path: `${out}/settings-00-new-session.png` })

const settings = page.getByRole("button", { name: "Settings", exact: true })
await settings.first().click()
await page.waitForSelector('[data-component="dialog-v2"]', { timeout: 10000 })
await page.waitForTimeout(800)

const dialog = page.locator('[data-component="dialog-v2"]')
console.log(
  JSON.stringify(
    await page.evaluate(() => {
      const container = document.querySelector('[data-slot="dialog-container"]')
      const body = document.querySelector('[data-slot="dialog-body"]')
      return {
        scheme: document.documentElement.dataset.colorScheme,
        dialog: container?.getBoundingClientRect(),
        body: body?.getBoundingClientRect(),
        bodyOverflow: body ? getComputedStyle(body).overflow : null,
      }
    }),
    null,
    2,
  ),
)
await page.screenshot({ path: `${out}/settings-01-basic.png` })

// Turn advanced mode on so the Advanced tab exists, then look at each tab.
const showAll = page.getByRole("button", { name: "Show all options" })
if (await showAll.count()) {
  await showAll.first().click()
  await page.waitForTimeout(500)
}
await page.screenshot({ path: `${out}/settings-02-basic-advanced-on.png` })

const advanced = page.getByRole("tab", { name: "Advanced" })
if (await advanced.count()) {
  await advanced.first().click()
  await page.waitForTimeout(600)
  await page.screenshot({ path: `${out}/settings-03-advanced.png` })
}

const personalization = page.getByRole("tab", { name: "Personalization" })
await personalization.first().click()
await page.waitForTimeout(600)
await page.screenshot({ path: `${out}/settings-04-personalization.png` })

// Scroll to the end of Personalization to check the last cards and the scroll container.
await page.evaluate(() => {
  const scroller = [...document.querySelectorAll("div")].find((node) => {
    const style = getComputedStyle(node)
    return style.overflowY === "auto" && node.scrollHeight > node.clientHeight + 20
  })
  scroller?.scrollTo(0, scroller.scrollHeight)
})
await page.waitForTimeout(500)
await page.screenshot({ path: `${out}/settings-05-personalization-end.png` })

console.log("saved")
process.exit(0)
