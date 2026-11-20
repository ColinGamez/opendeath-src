import { chromium } from "file:///C:/od/app/node_modules/.bun/playwright@1.60.0/node_modules/playwright/index.mjs"
const browser = await chromium.connectOverCDP("http://127.0.0.1:9230")
const pages = browser.contexts().flatMap((c) => c.pages())
const page = pages.find((p) => p.url().includes("renderer")) ?? pages[0]
if (!page) throw new Error("no renderer")
await page.bringToFront()
await page.waitForTimeout(2500)
const info = await page.evaluate(() => ({
  title: document.title,
  hasNewSession: Boolean(document.querySelector('[data-component="new-session"]')),
  buttons: [...document.querySelectorAll("button")].map((b) => b.textContent?.replace(/\s+/g, " ").trim()).filter((t) => t && ["Fix connection","Status","Reset limit","Settings"].includes(t)),
  hero: [...document.images].find((i) => (i.currentSrc || i.src).includes("opendeath-hero"))?.getBoundingClientRect().width ?? null,
  scheme: document.documentElement.dataset.colorScheme,
  text: document.body.innerText.split("\n").map((l) => l.trim()).filter(Boolean).slice(0, 12),
}))
console.log(JSON.stringify(info, null, 2))
await page.screenshot({ path: "C:/Users/Kylem/Documents/Qoder/2026-11-17/02a21507/analysis/desktop-portable-launch.png" })
process.exit(0)
