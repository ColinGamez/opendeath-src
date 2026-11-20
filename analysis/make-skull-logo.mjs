import sharp from "file:///C:/od/app/node_modules/.bun/sharp@0.35.5+4ece0cffe9718641/node_modules/sharp/dist/index.mjs"
import { mkdir, writeFile } from "node:fs/promises"

const W = 32
const H = 32

const spans = new Map([
  [2, [12, 19]],
  [3, [10, 21]],
  [4, [8, 23]],
  [5, [7, 24]],
  [6, [6, 25]],
  [7, [5, 26]],
  [8, [4, 27]],
  [9, [4, 27]],
  [10, [3, 28]],
  [11, [3, 28]],
  [12, [3, 28]],
  [13, [3, 28]],
  [14, [4, 27]],
  [15, [5, 26]],
  [16, [6, 25]],
  [17, [7, 24]],
  [18, [8, 23]],
  [19, [9, 22]],
  [20, [10, 21]],
  [21, [10, 21]],
  [22, [10, 21]],
  [23, [10, 21]],
])

const solid = (x, y) => {
  const span = spans.get(y)
  return Boolean(span && x >= span[0] && x <= span[1])
}

// sockets, nose and the mouth line are cut out of the face after it is drawn.
const cut = new Set()
for (let y = 11; y <= 14; y++) for (let x = 8; x <= 11; x++) cut.add(`${x},${y}`)
for (let y = 11; y <= 14; y++) for (let x = 20; x <= 23; x++) cut.add(`${x},${y}`)
for (let x = 15; x <= 16; x++) cut.add(`${x},15`)
for (let x = 14; x <= 17; x++) cut.add(`${x},16`)
for (let x = 15; x <= 16; x++) cut.add(`${x},17`)

const palette = {
  deep: "#24040a",
  edge: "#520812",
  base: "#a91427",
  light: "#d93447",
  bright: "#f26374",
  socket: "#100204",
  rim: "#3f0710",
  tooth: "#ef5c6d",
}

const cells = []
const add = (x, y, color) => {
  if (x < 0 || y < 0 || x >= W || y >= H) return
  cells.push({ x, y, color })
}

// Two offset copies give the mark a chunky extruded depth behind the face.
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    if (!solid(x, y)) continue
    add(x + 3, y + 5, palette.deep)
  }
}
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    if (!solid(x, y)) continue
    add(x + 1, y + 2, palette.edge)
  }
}

for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    if (!solid(x, y) || cut.has(`${x},${y}`)) continue
    const top = !solid(x, y - 1)
    const left = !solid(x - 1, y)
    const bottom = !solid(x, y + 1)
    const right = !solid(x + 1, y)
    let color = palette.base
    if (top) color = palette.bright
    else if (left) color = palette.light
    else if (bottom || right) color = palette.edge
    add(x, y, color)
  }
}

// Socket rims keep the holes readable against the bright face.
for (const key of cut) {
  const [x, y] = key.split(",").map(Number)
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
    if (!cut.has(`${x + dx},${y + dy}`) && solid(x + dx, y + dy)) add(x + dx, y + dy, palette.rim)
  }
}
for (const key of cut) {
  const [x, y] = key.split(",").map(Number)
  add(x, y, palette.socket)
}

// Teeth: four bright blocks with dark gaps over the jaw.
const teeth = [
  [11, 21, 2],
  [14, 21, 2],
  [17, 21, 2],
  [20, 21, 2],
]
for (const [x, y, width] of teeth) {
  for (let yy = y; yy <= 23; yy++) {
    for (let xx = x; xx < x + width; xx++) {
      if (!solid(xx, yy)) continue
      add(xx, yy, yy === 21 ? palette.bright : palette.tooth)
    }
  }
}
for (let x = 10; x <= 21; x++) add(x, 20, palette.socket)

// A small highlight on the cranium sells the glossy retro plastic.
for (const [x, y] of [[9, 5], [10, 5], [9, 6], [21, 5], [20, 5], [21, 6]]) add(x, y, palette.bright)

// Nudge the whole mark one cell left and one down so the face sits centered and the
// extrusion still has a transparent margin on every side.
for (const cell of cells) {
  cell.x -= 1
  cell.y += 1
}

const size = 16
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W * size}" height="${H * size}" viewBox="0 0 ${W} ${H}" shape-rendering="crispEdges">${cells
  .map(({ x, y, color }) => `<rect x="${x}" y="${y}" width="1" height="1" fill="${color}"/>`)
  .join("")}</svg>`

await mkdir("C:/od/app/analysis/skull", { recursive: true })
await writeFile("C:/od/app/analysis/skull/opendeath-skull.svg", svg)
await sharp(Buffer.from(svg)).png().toFile("C:/od/app/analysis/skull/opendeath-skull.png")
console.log("wrote", cells.length, "rects")
