import { chromium } from "file:///C:/od/app/node_modules/.bun/playwright@1.60.0/node_modules/playwright/index.mjs"

const browser = await chromium.connectOverCDP("http://127.0.0.1:9222")
const pages = browser.contexts().flatMap((context) => context.pages())
const page = pages.find((candidate) => candidate.url().includes("renderer")) ?? pages[0]
await page.bringToFront()
const state = () =>
  page.evaluate(() => ({
    dialogs: document.querySelectorAll('[data-component="dialog-v2"]').length,
    bodies: document.querySelectorAll('[data-slot="dialog-body"]').length,
    settings: [...document.querySelectorAll("button")].filter((node) => node.textContent?.trim() === "Settings").map((node) => ({ visible: node.getBoundingClientRect().width > 0, rect: node.getBoundingClientRect().toJSON() })),
    active: document.activeElement?.outerHTML?.slice(0, 120),
  }))
console.log("before", JSON.stringify(await state(), null, 2))
await page.evaluate(() => {
  const hit = [...document.querySelectorAll("button")].find((node) => node.textContent?.trim() === "Settings" && node.getBoundingClientRect().width > 0)
  hit?.click()
})
await page.waitForTimeout(700)
console.log("after-700", JSON.stringify(await state(), null, 2))
await page.waitForTimeout(2000)
console.log("after-2700", JSON.stringify(await state(), null, 2))
await page.screenshot({ path: "C:/Users/Kylem/Documents/Qoder/2026-11-17/02a21507/analysis/debug-dialog.png" })
process.exit(0)
