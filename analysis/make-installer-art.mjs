import sharp from "file:///C:/od/app/node_modules/.bun/sharp@0.35.5+4ece0cffe9718641/node_modules/sharp/dist/index.mjs"
import { mkdir, readFile, writeFile } from "node:fs/promises"

const out = "C:/Users/Kylem/Documents/Qoder/2026-11-17/02a21507/installer/assets"
await mkdir(out, { recursive: true })

const skull = await readFile("C:/od/app/analysis/skull/opendeath-skull.png")
const skull64 = skull.toString("base64")

function bmp(width, height, rgb) {
  const row = width * 3
  const padded = Math.ceil(row / 4) * 4
  const image = padded * height
  const buffer = Buffer.alloc(54 + image)
  buffer.write("BM", 0)
  buffer.writeUInt32LE(54 + image, 2)
  buffer.writeUInt32LE(54, 10)
  buffer.writeUInt32LE(40, 14)
  buffer.writeInt32LE(width, 18)
  buffer.writeInt32LE(height, 22)
  buffer.writeUInt16LE(1, 26)
  buffer.writeUInt16LE(24, 28)
  buffer.writeUInt32LE(image, 34)
  buffer.writeInt32LE(2835, 38)
  buffer.writeInt32LE(2835, 42)
  for (let y = 0; y < height; y++) {
    const src = y * row
    const dst = 54 + (height - 1 - y) * padded
    for (let x = 0; x < width; x++) {
      buffer[dst + x * 3] = rgb[src + x * 3 + 2]
      buffer[dst + x * 3 + 1] = rgb[src + x * 3 + 1]
      buffer[dst + x * 3 + 2] = rgb[src + x * 3]
    }
  }
  return buffer
}

const welcome = `<svg xmlns="http://www.w3.org/2000/svg" width="164" height="314">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#170609"/>
      <stop offset="0.55" stop-color="#0c0709"/>
      <stop offset="1" stop-color="#070506"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="38%" r="55%">
      <stop offset="0" stop-color="#b1162a" stop-opacity="0.38"/>
      <stop offset="0.55" stop-color="#7d0d1c" stop-opacity="0.12"/>
      <stop offset="1" stop-color="#000000" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="164" height="314" fill="url(#bg)"/>
  <rect width="164" height="314" fill="url(#glow)"/>
  <image href="data:image/png;base64,${skull64}" x="26" y="54" width="112" height="112"/>
  <rect x="34" y="190" width="96" height="1" fill="#5c0b16"/>
  <text x="82" y="214" text-anchor="middle" font-family="Segoe UI, Arial" font-size="15" font-weight="700" fill="#e85566" letter-spacing="2">OPENDEATH</text>
  <text x="82" y="232" text-anchor="middle" font-family="Segoe UI, Arial" font-size="8" fill="#8b6b70" letter-spacing="1.1">INFINITE DESKTOP</text>
  <text x="82" y="296" text-anchor="middle" font-family="Segoe UI, Arial" font-size="7" fill="#5f4a4e">v1.0.0</text>
</svg>`

const header = `<svg xmlns="http://www.w3.org/2000/svg" width="150" height="57">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#0a0708"/>
      <stop offset="1" stop-color="#170609"/>
    </linearGradient>
    <radialGradient id="glow" cx="76%" cy="46%" r="58%">
      <stop offset="0" stop-color="#b1162a" stop-opacity="0.42"/>
      <stop offset="1" stop-color="#000000" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="150" height="57" fill="url(#bg)"/>
  <rect width="150" height="57" fill="url(#glow)"/>
  <rect x="0" y="55" width="150" height="2" fill="#b1162a"/>
  <image href="data:image/png;base64,${skull64}" x="97" y="3" width="50" height="50"/>
  <text x="10" y="28" font-family="Segoe UI, Arial" font-size="13" font-weight="700" fill="#e9e5e6">OpenDeath</text>
  <text x="10" y="42" font-family="Segoe UI, Arial" font-size="7" fill="#9b7176" letter-spacing="1.2">INFINITE DESKTOP</text>
</svg>`

for (const [name, svg, width, height] of [
  ["welcome.bmp", welcome, 164, 314],
  ["header.bmp", header, 150, 57],
]) {
  await sharp(Buffer.from(svg)).png().toFile(`${out}/${name.replace(/\.bmp$/, "-preview.png")}`)
  const { data } = await sharp(Buffer.from(svg)).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  await writeFile(`${out}/${name}`, bmp(width, height, data))
  console.log(name, width, height)
}
