import { chromium } from "file:///C:/od/app/node_modules/.bun/playwright@1.60.0/node_modules/playwright/index.mjs"

const browser = await chromium.connectOverCDP("http://127.0.0.1:9222")
const pages = browser.contexts().flatMap((context) => context.pages())
const page = pages.find((candidate) => candidate.url().includes("renderer")) ?? pages[0]
await page.bringToFront()
await page.evaluate(() => {
  localStorage.setItem("opencode-theme-id", "oc-2")
  localStorage.setItem("opencode-color-scheme", "dark")
  location.reload()
})
await page.waitForTimeout(3000)
await page.keyboard.press("Control+t")
await page.waitForSelector('[data-component="new-session"]', { timeout: 15000 })
await page.waitForTimeout(1500)
console.log(
  JSON.stringify(
    await page.evaluate(() => ({
      scheme: document.documentElement.dataset.colorScheme,
      theme: document.documentElement.dataset.theme,
      hero: [...document.images].find((image) => (image.currentSrc || image.src).includes("opendeath-hero"))?.getBoundingClientRect(),
    })),
    null,
    2,
  ),
)
await page.screenshot({ path: "C:/Users/Kylem/Documents/Qoder/2026-11-17/02a21507/analysis/new-session-hero-dark.png" })
process.exit(0)
