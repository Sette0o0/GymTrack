import { deflateSync } from "node:zlib"
import { mkdirSync, writeFileSync } from "node:fs"

// A small geometric dumbbell drawn directly into PNG pixels; no runtime CDN.
function crc(buffer) {
  let result = 0xffffffff
  for (const byte of buffer) {
    result ^= byte
    for (let bit = 0; bit < 8; bit++)
      result = (result >>> 1) ^ (result & 1 ? 0xedb88320 : 0)
  }
  return (result ^ 0xffffffff) >>> 0
}
function chunk(type, data) {
  const name = Buffer.from(type)
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const checksum = Buffer.alloc(4)
  checksum.writeUInt32BE(crc(Buffer.concat([name, data])))
  return Buffer.concat([length, name, data, checksum])
}
function icon(size, file) {
  const data = Buffer.alloc((size * 4 + 1) * size)
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const u = x / size,
        v = y / size
      const shape =
        (u > 0.28 && u < 0.72 && v > 0.46 && v < 0.54) ||
        (((u > 0.23 && u < 0.34) || (u > 0.66 && u < 0.77)) &&
          v > 0.3 &&
          v < 0.7) ||
        (((u > 0.16 && u < 0.24) || (u > 0.76 && u < 0.84)) &&
          v > 0.38 &&
          v < 0.62)
      const offset = y * (size * 4 + 1) + 1 + x * 4
      Buffer.from(shape ? [214, 237, 182, 255] : [17, 44, 36, 255]).copy(
        data,
        offset
      )
    }
  const header = Buffer.alloc(13)
  header.writeUInt32BE(size)
  header.writeUInt32BE(size, 4)
  header[8] = 8
  header[9] = 6
  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(data)),
    chunk("IEND", Buffer.alloc(0)),
  ])
  writeFileSync(`public/icons/${file}`, png)
  return png
}
mkdirSync("public/icons", { recursive: true })
icon(192, "icon-192.png")
icon(512, "icon-512.png")
icon(512, "maskable-512.png")
icon(180, "apple-touch-icon.png")
const favicon = icon(32, "favicon-32.png")
const directory = Buffer.alloc(22)
directory.writeUInt16LE(1, 2)
directory.writeUInt16LE(1, 4)
directory[6] = 32
directory[7] = 32
directory.writeUInt16LE(1, 10)
directory.writeUInt16LE(32, 12)
directory.writeUInt32LE(favicon.length, 14)
directory.writeUInt32LE(22, 18)
writeFileSync("app/favicon.ico", Buffer.concat([directory, favicon]))
