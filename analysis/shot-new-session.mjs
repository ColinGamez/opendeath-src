import { chromium } from "file:///C:/od/app/node_modules/.bun/playwright@1.60.0/node_modules/playwright/index.mjs"

const browser = await chromium.connectOverCDP("http://127.0.0.1:9222")
const pages = browser.contexts().flatMap((context) => context.pages())
console.log("pages", await Promise.all(pages.map(async (page) => ({ url: page.url(), title: await page.title() }))))
const page = pages.find((candidate) => candidate.url().includes("renderer/index.html")) ?? pages[0]
if (!page) throw new Error("no renderer page")
await page.bringToFront()
await page.waitForTimeout(1500)
await page.keyboard.press("Control+t")
await page.waitForSelector('[data-component="new-session"]', { timeout: 15000 })
await page.waitForTimeout(1500)
console.log("title", await page.title())
console.log("body", (await page.locator("body").innerText()).slice(0, 400))
await page.screenshot({ path: "C:\\Users\\Kylem\\Documents\\Qoder\\2026-11-17\\02a21507\\analysis\\new-session-hero.png" })
console.log("saved")
