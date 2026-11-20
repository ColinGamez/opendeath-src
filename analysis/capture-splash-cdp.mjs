import { chromium } from "file:///C:/od/app/node_modules/.bun/playwright@1.60.0/node_modules/playwright/index.mjs"
import { writeFile } from "node:fs/promises"

const out = "C:/Users/Kylem/Documents/Qoder/2026-11-17/02a21507/analysis"
let browser
for (let attempt = 0; attempt < 300; attempt++) {
  try {
    browser = await chromium.connectOverCDP("http://127.0.0.1:9235")
    break
  } catch {
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
}
if (!browser) throw new Error("no cdp")
const pages = browser.contexts().flatMap((context) => context.pages())
const page = pages.find((candidate) => candidate.url().includes("renderer")) ?? pages[0]
if (!page) throw new Error("no renderer")
const client = await page.context().newCDPSession(page)

let seen = false
for (let attempt = 0; attempt < 200; attempt++) {
  const state = await client.send("Runtime.evaluate", {
    expression: `(() => { const el = document.querySelector('[data-component="startup-splash"]'); const img = [...document.images].find((i) => (i.currentSrc || i.src).includes('opendeath-mark')); return { splash: Boolean(el), rect: img ? img.getBoundingClientRect().toJSON() : null, scheme: document.documentElement.dataset.colorScheme } })()`,
    returnByValue: true,
  })
  const value = state.result.value
  if (value?.splash) {
    seen = true
    console.log(JSON.stringify(value, null, 2))
    const shot = await client.send("Page.captureScreenshot", { format: "png", fromSurface: true })
    await writeFile(`${out}/splash-cdp.png`, Buffer.from(shot.data, "base64"))
    break
  }
  await new Promise((resolve) => setTimeout(resolve, 60))
}
console.log("seen", seen)
process.exit(0)
