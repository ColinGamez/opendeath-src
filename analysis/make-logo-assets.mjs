import sharp from "file:///C:/od/app/node_modules/.bun/sharp@0.35.5+4ece0cffe9718641/node_modules/sharp/dist/index.mjs"
import { mkdir, readFile, writeFile } from "node:fs/promises"

const src = "C:/od/app/analysis/skull/opendeath-skull.png"
const app = "C:/od/app/packages/app/public"
const icons = "C:/od/app/packages/desktop/icons/prod"

await mkdir(app, { recursive: true })
await mkdir(icons, { recursive: true })

const trimmed = await sharp(src).trim({ threshold: 1 }).png().toBuffer()

// In-app mark: transparent, with enough breathing room for a 20 px titlebar use.
const mark = await sharp(trimmed)
  .resize(480, 480, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 }, kernel: "nearest" })
  .extend({ top: 16, bottom: 16, left: 16, right: 16, background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toBuffer()
await writeFile(`${app}/opendeath-mark.png`, mark)

// App/favicon tile: the mark on the same near-black rounded tile used by the brand.
const tile = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024">
  <defs>
    <radialGradient id="glow" cx="50%" cy="38%" r="72%">
      <stop offset="0" stop-color="#34080f"/>
      <stop offset="1" stop-color="#090708"/>
    </radialGradient>
  </defs>
  <rect x="36" y="36" width="952" height="952" rx="218" fill="url(#glow)"/>
  <rect x="36" y="36" width="952" height="952" rx="218" fill="none" stroke="#5c0b16" stroke-width="12"/>
</svg>`

const skullTile = await sharp(trimmed)
  .resize(724, 724, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 }, kernel: "nearest" })
  .png()
  .toBuffer()

const icon = await sharp(Buffer.from(tile))
  .composite([{ input: skullTile, left: 150, top: 138 }])
  .png()
  .toBuffer()

await writeFile(`${icons}/icon.png`, icon)

const sizes = [16, 24, 32, 48, 64, 128, 256, 512]
const pngs = new Map()
for (const size of sizes) {
  const buf = await sharp(icon).resize(size, size, { kernel: "nearest" }).png().toBuffer()
  pngs.set(size, buf)
}

for (const size of [16, 24, 32, 48, 64, 128]) await writeFile(`${icons}/${size}x${size}.png`, pngs.get(size))
await writeFile(`${icons}/128x128@2x.png`, pngs.get(256))
await writeFile(`${icons}/dock.png`, pngs.get(512))
await writeFile(`${app}/favicon-96x96.png`, await sharp(icon).resize(96, 96, { kernel: "nearest" }).png().toBuffer())
await writeFile(`${app}/favicon-96x96-v3.png`, await sharp(icon).resize(96, 96, { kernel: "nearest" }).png().toBuffer())
await writeFile(`${app}/apple-touch-icon.png`, await sharp(icon).resize(180, 180, { kernel: "nearest" }).png().toBuffer())
await writeFile(`${app}/apple-touch-icon-v3.png`, await sharp(icon).resize(180, 180, { kernel: "nearest" }).png().toBuffer())

// ICO with PNG-compressed entries (Vista and later).
function ico(entries) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(entries.length, 4)
  const directory = Buffer.alloc(16 * entries.length)
  let offset = 6 + directory.length
  entries.forEach(({ size, data }, index) => {
    const at = index * 16
    directory[at] = size >= 256 ? 0 : size
    directory[at + 1] = size >= 256 ? 0 : size
    directory.writeUInt16LE(1, at + 4)
    directory.writeUInt16LE(32, at + 6)
    directory.writeUInt32LE(data.length, at + 8)
    directory.writeUInt32LE(offset, at + 12)
    offset += data.length
  })
  return Buffer.concat([header, directory, ...entries.map((entry) => entry.data)])
}

const icoEntries = [16, 24, 32, 48, 64, 128, 256].map((size) => ({ size, data: pngs.get(size) }))
const icoData = ico(icoEntries)
await writeFile(`${icons}/icon.ico`, icoData)
await writeFile(`${app}/favicon.ico`, ico(icoEntries.filter((entry) => entry.size <= 64)))
await writeFile(`${app}/favicon-v3.ico`, ico(icoEntries.filter((entry) => entry.size <= 64)))

// Scalable favicon keeps the exact pixel cells of the mark on the dark tile.
const skullSvg = await readFile("C:/od/app/analysis/skull/opendeath-skull.svg", "utf8")
const inner = skullSvg.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "")
const faviconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36" shape-rendering="crispEdges"><rect width="36" height="36" rx="8" fill="#0f0b0c"/><g transform="translate(2 2)">${inner}</g></svg>`
await writeFile(`${app}/favicon.svg`, faviconSvg)
await writeFile(`${app}/favicon-v3.svg`, faviconSvg)

console.log("mark", mark.length, "icon", icon.length, "ico", icoData.length, "sizes", sizes.join(","))
