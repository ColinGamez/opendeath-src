import { chromium } from "file:///C:/od/app/node_modules/.bun/playwright@1.60.0/node_modules/playwright/index.mjs"

const out = "C:/Users/Kylem/Documents/Qoder/2026-11-17/02a21507/analysis"
let browser
for (let attempt = 0; attempt < 240; attempt++) {
  try {
    browser = await chromium.connectOverCDP("http://127.0.0.1:9231")
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

let splash = false
for (let attempt = 0; attempt < 120; attempt++) {
  splash = await page.evaluate(() => Boolean(document.querySelector('[data-component="startup-splash"]')))
  if (splash) break
  await page.waitForTimeout(100)
}

const early = await page.evaluate(() => {
  const mark = [...document.images].find((image) => (image.currentSrc || image.src).includes("opendeath-mark"))
  return {
    splash: Boolean(document.querySelector('[data-component="startup-splash"]')),
    first: Boolean(document.querySelector('[data-component="first-launch-splash"]')),
    mark: mark ? { ...mark.getBoundingClientRect().toJSON(), src: mark.currentSrc || mark.src } : null,
    scheme: document.documentElement.dataset.colorScheme,
  }
})
console.log(JSON.stringify(early, null, 2))
await page.screenshot({ path: `${out}/splash-final.png` })
await page.waitForTimeout(1800)
const later = await page.evaluate(() => ({
  splash: Boolean(document.querySelector('[data-component="startup-splash"]')),
  first: Boolean(document.querySelector('[data-component="first-launch-splash"]')),
  scheme: document.documentElement.dataset.colorScheme,
}))
console.log(JSON.stringify(later, null, 2))
await page.screenshot({ path: `${out}/splash-final-later.png` })
process.exit(0)
