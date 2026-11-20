import { chromium } from "file:///C:/od/app/node_modules/.bun/playwright@1.60.0/node_modules/playwright/index.mjs"

const browser = await chromium.connectOverCDP("http://127.0.0.1:9230")
const pages = browser.contexts().flatMap((context) => context.pages())
const page = pages.find((candidate) => candidate.url().includes("renderer")) ?? pages[0]
if (!page) throw new Error("no renderer page")
await page.bringToFront()
await page.waitForTimeout(1800)
const info = await page.evaluate(() => ({
  title: document.title,
  scheme: document.documentElement.dataset.colorScheme,
  text: document.body.innerText.replace(/\s+/g, " ").trim().slice(0, 220),
}))
console.log(JSON.stringify(info, null, 2))
await page.screenshot({ path: "C:/Users/Kylem/Documents/Qoder/2026-11-17/02a21507/analysis/desktop-launch.png" })
process.exit(0)
