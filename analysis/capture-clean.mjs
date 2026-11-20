import { chromium } from "file:///C:/od/app/node_modules/.bun/playwright@1.60.0/node_modules/playwright/index.mjs"

const out = "C:/Users/Kylem/Documents/Qoder/2026-11-17/02a21507/analysis"
let browser
for (let attempt = 0; attempt < 200; attempt++) {
  try {
    browser = await chromium.connectOverCDP("http://127.0.0.1:9232")
    break
  } catch {
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
}
if (!browser) throw new Error("no cdp")
const pages = browser.contexts().flatMap((context) => context.pages())
const page = pages.find((candidate) => candidate.url().includes("renderer")) ?? pages[0]
if (!page) throw new Error("no renderer page")
await page.bringToFront()
for (let attempt = 0; attempt < 240; attempt++) {
  const ready = await page.evaluate(() => !document.querySelector('[data-component="startup-splash"]'))
  if (ready) break
  await page.waitForTimeout(250)
}
await page.waitForTimeout(2500)
const info = await page.evaluate(() => ({
  title: document.title,
  splash: Boolean(document.querySelector('[data-component="startup-splash"]')),
  onboarding: Boolean(document.querySelector('[data-component*="onboarding"]')),
  text: document.body.innerText.slice(0, 600),
  buttons: [...document.querySelectorAll("button")].map((b) => b.innerText.trim()).filter(Boolean).slice(0, 40),
}))
console.log(JSON.stringify(info, null, 2))
await page.screenshot({ path: `${out}/clean-new-session.png` })
process.exit(0)
