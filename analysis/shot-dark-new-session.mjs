import { chromium } from "file:///C:/od/app/node_modules/.bun/playwright@1.60.0/node_modules/playwright/index.mjs"

const browser = await chromium.connectOverCDP("http://127.0.0.1:9222")
const pages = browser.contexts().flatMap((context) => context.pages())
const page = pages.find((candidate) => candidate.url().includes("renderer")) ?? pages[0]
if (!page) throw new Error("no renderer page")
await page.bringToFront()
await page.evaluate(() => localStorage.setItem("opencode-color-scheme", "dark"))
await page.reload({ waitUntil: "domcontentloaded" })
await page.waitForTimeout(3500)
await page.keyboard.press("Control+t")
await page.waitForSelector('[data-component="new-session"]', { timeout: 15000 })
await page.waitForTimeout(1200)
console.log("scheme", await page.evaluate(() => document.documentElement.dataset.colorScheme))
await page.screenshot({ path: "C:/Users/Kylem/Documents/Qoder/2026-11-17/02a21507/analysis/new-session-dark.png" })
console.log("saved")
process.exit(0)
