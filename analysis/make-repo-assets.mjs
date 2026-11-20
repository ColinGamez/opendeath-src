import sharp from "file:///C:/od/app/node_modules/.bun/sharp@0.35.5+4ece0cffe9718641/node_modules/sharp/dist/index.mjs"
import { mkdir, readFile, writeFile } from "node:fs/promises"

const out = "C:/Users/Kylem/Documents/Qoder/2026-11-17/02a21507/github/OpenDeath/assets"
await mkdir(out, { recursive: true })

const skull = (await readFile("C:/od/app/analysis/skull/opendeath-skull.png")).toString("base64")

// The in-app wordmark uses a near-black "open" that disappears on a dark banner.
// Lift only the neutral grey fill; the red letters and the darker extrusion stay untouched.
const wordRaw = await sharp("C:/od/app/packages/app/public/opendeath-hero.png")
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true })
const wordPixels = Buffer.from(wordRaw.data)
for (let i = 0; i < wordPixels.length; i += 4) {
  const [r, g, b, a] = [wordPixels[i], wordPixels[i + 1], wordPixels[i + 2], wordPixels[i + 3]]
  const neutral = Math.max(r, g, b) - Math.min(r, g, b) < 14
  if (a > 0 && neutral && r >= 40 && r <= 90) {
    wordPixels[i] = 214
    wordPixels[i + 1] = 209
    wordPixels[i + 2] = 211
  } else if (a > 0 && r > 55 && r > g * 1.6 && r > b * 1.3) {
    wordPixels[i] = Math.min(255, Math.round(r * 1.55 + 18))
    wordPixels[i + 1] = Math.min(255, Math.round(g * 1.15 + 6))
    wordPixels[i + 2] = Math.min(255, Math.round(b * 1.2 + 8))
  }
}
const wordmark = (
  await sharp(wordPixels, { raw: { width: wordRaw.info.width, height: wordRaw.info.height, channels: 4 } })
    .png()
    .toBuffer()
).toString("base64")

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="360">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#080607"/>
      <stop offset="0.55" stop-color="#12070a"/>
      <stop offset="1" stop-color="#080607"/>
    </linearGradient>
    <radialGradient id="glow" cx="18%" cy="48%" r="42%">
      <stop offset="0" stop-color="#b1162a" stop-opacity="0.34"/>
      <stop offset="1" stop-color="#000000" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glow2" cx="78%" cy="42%" r="46%">
      <stop offset="0" stop-color="#7d0d1c" stop-opacity="0.18"/>
      <stop offset="1" stop-color="#000000" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1280" height="360" fill="url(#bg)"/>
  <rect width="1280" height="360" fill="url(#glow)"/>
  <rect width="1280" height="360" fill="url(#glow2)"/>
  <rect x="0" y="352" width="1280" height="8" fill="#b1162a"/>
  <rect x="0" y="340" width="1280" height="1" fill="#4a0a13"/>

  <image href="data:image/png;base64,${skull}" x="70" y="62" width="236" height="236"/>

  <image href="data:image/png;base64,${wordmark}" x="336" y="112" width="680" height="159"/>

  <text x="340" y="286" font-family="Segoe UI, Arial" font-size="15" font-weight="600" fill="#c98b93" letter-spacing="7">INFINITE DESKTOP</text>
  <text x="1112" y="292" text-anchor="end" font-family="Segoe UI, Arial" font-size="12" fill="#7d5a60" letter-spacing="2">v1.0.0</text>

  <g fill="#b1162a">
    <rect x="340" y="300" width="46" height="2"/>
    <rect x="392" y="300" width="10" height="2" opacity="0.6"/>
    <rect x="408" y="300" width="4" height="2" opacity="0.35"/>
  </g>
</svg>`

await sharp(Buffer.from(svg)).png().toFile(`${out}/banner.png`)

// Square mark for social previews and README avatars.
await sharp("C:/od/app/packages/app/public/opendeath-mark.png")
  .resize(512, 512, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 }, kernel: "nearest" })
  .png()
  .toFile(`${out}/skull.png`)

// Copy the best screenshots and normalise their width for the README.
// The app was captured with real tabs, a real exit IP, and a local path. Crop below the
// tab strip, and replace the IP/path text with neutral labels before publishing.
const session = "C:/Users/Kylem/Documents/Qoder/2026-11-17/02a21507/analysis/new-session-dark.png"
const sessionMeta = await sharp(session).metadata()
const redaction = `<svg xmlns="http://www.w3.org/2000/svg" width="${sessionMeta.width}" height="${sessionMeta.height}">
  <rect x="1040" y="46" width="326" height="30" fill="#0a0a0a"/>
  <text x="1338" y="66" text-anchor="end" font-family="Segoe UI, Arial" font-size="12" fill="#9a9a9a">WARP · connected</text>
  <rect x="220" y="520" width="1140" height="28" fill="#0c0b0b"/>
  <text x="1338" y="540" text-anchor="end" font-family="Segoe UI, Arial" font-size="12" fill="#7d7d7d">Local workspace</text>
</svg>`

const redactionPng = await sharp(Buffer.from(redaction))
  .resize(sessionMeta.width, sessionMeta.height, { fit: "fill" })
  .png()
  .toBuffer()
const cleanSession = await sharp({
  create: { width: sessionMeta.width, height: sessionMeta.height, channels: 4, background: "#0a0a0b" },
})
  .composite([
    { input: session, left: 0, top: 0 },
    { input: redactionPng, left: 0, top: 0 },
  ])
  .png()
  .toBuffer()

await sharp(cleanSession)
  .extract({ left: 0, top: 38, width: 1366, height: 690 })
  .extend({ top: 10, bottom: 10, left: 10, right: 10, background: "#0a0a0b" })
  .resize({ width: 1200, withoutEnlargement: true })
  .png({ compressionLevel: 9 })
  .toFile(`${out}/screenshot-session.png`)

for (const [src, name] of [
  ["C:/Users/Kylem/Documents/Qoder/2026-11-17/02a21507/analysis/check-02-advanced.png", "screenshot-settings.png"],
  ["C:/Users/Kylem/Documents/Qoder/2026-11-17/02a21507/analysis/check-03-personalization.png", "screenshot-personalization.png"],
]) {
  await sharp(src)
    .extract({ left: 160, top: 40, width: 1020, height: 666 })
    .extend({ top: 14, bottom: 14, left: 14, right: 14, background: "#0a0a0b" })
    .resize({ width: 1100, withoutEnlargement: true })
    .png({ compressionLevel: 9 })
    .toFile(`${out}/${name}`)
}

console.log("screenshots written")
console.log("banner written")
