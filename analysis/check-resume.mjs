import { chromium } from "file:///C:/od/app/node_modules/.bun/playwright@1.60.0/node_modules/playwright/index.mjs"

const browser = await chromium.connectOverCDP("http://127.0.0.1:9222")
const pages = browser.contexts().flatMap((context) => context.pages())
const page = pages.find((candidate) => candidate.url().includes("renderer")) ?? pages[0]
await page.bringToFront()
const text = await page.evaluate(() => document.body.innerText)
console.log(
  text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /continue|new IP|auto-rotate|waiting|sent .* chat/i.test(line))
    .join("\n") || "(no resume status text)",
)
await page.screenshot({ path: "C:/Users/Kylem/Documents/Qoder/2026-11-17/02a21507/analysis/resume-status.png" })
process.exit(0)
