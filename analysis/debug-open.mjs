import { chromium } from "file:///C:/od/app/node_modules/.bun/playwright@1.60.0/node_modules/playwright/index.mjs"

const browser = await chromium.connectOverCDP("http://127.0.0.1:9222")
const pages = browser.contexts().flatMap((context) => context.pages())
const page = pages.find((candidate) => candidate.url().includes("renderer")) ?? pages[0]
await page.bringToFront()
page.on("console", (message) => console.log("console", message.type(), message.text().slice(0, 500)))
page.on("pageerror", (error) => console.log("pageerror", error.message.slice(0, 800)))

console.log(
  "buttons",
  await page.evaluate(() =>
    [...document.querySelectorAll("button")]
      .filter((node) => node.getBoundingClientRect().width > 0)
      .map((node) => node.textContent?.replace(/\s+/g, " ").trim())
      .filter((text) => text === "Settings"),
  ),
)
await page.evaluate(() => {
  const hit = [...document.querySelectorAll("button")].find((node) => node.textContent?.trim() === "Settings" && node.getBoundingClientRect().width > 0)
  hit?.click()
})
for (const wait of [100, 300, 700, 1500, 3000]) {
  await page.waitForTimeout(wait === 100 ? 100 : wait - 0)
  console.log(
    wait,
    JSON.stringify(
      await page.evaluate(() => ({
        dialogs: document.querySelectorAll('[data-component="dialog-v2"]').length,
        text: document.querySelector('[data-component="dialog-v2"]')?.textContent?.replace(/\s+/g, " ").trim().slice(0, 120) ?? null,
      })),
    ),
  )
}
await page.screenshot({ path: "C:/Users/Kylem/Documents/Qoder/2026-11-17/02a21507/analysis/debug-open.png" })
process.exit(0)
