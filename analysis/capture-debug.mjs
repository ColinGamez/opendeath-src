import { chromium } from "file:///C:/od/app/node_modules/.bun/playwright@1.60.0/node_modules/playwright/index.mjs"

const out = "C:/Users/Kylem/Documents/Qoder/2026-11-17/02a21507/analysis"
const browser = await chromium.connectOverCDP("http://127.0.0.1:9232")
const pages = browser.contexts().flatMap((context) => context.pages())
for (const [index, page] of pages.entries()) console.log("page", index, page.url())
const page = pages.find((candidate) => candidate.url().includes("renderer")) ?? pages[0]
await page.bringToFront()
const info = await page.evaluate(() => ({
  html: document.body.innerHTML.slice(0, 4000),
  components: [...document.querySelectorAll("[data-component]")].map((el) => el.getAttribute("data-component")),
  slots: [...document.querySelectorAll("[data-slot]")].map((el) => el.getAttribute("data-slot")),
  buttons: [...document.querySelectorAll("button")].map((b) => b.innerText.trim()).filter(Boolean),
  links: [...document.querySelectorAll("a")].map((a) => a.innerText.trim()).filter(Boolean),
  text: document.body.innerText,
}))
console.log(JSON.stringify(info, null, 2))
await page.screenshot({ path: `${out}/clean-debug.png` })
process.exit(0)
