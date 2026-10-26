import { generateSW } from "workbox-build"
import { readdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"

const directory = path.resolve("out")
const files = []
async function walk(folder) {
  for (const item of await readdir(folder, { withFileTypes: true })) {
    const file = path.join(folder, item.name)
    if (item.isDirectory()) await walk(file)
    else files.push(path.relative(directory, file).replaceAll("\\", "/"))
  }
}
await walk(directory)
const essential = files.filter(
  (file) =>
    !file.endsWith(".map") &&
    !file.startsWith("sw") &&
    !file.startsWith("workbox-") &&
    file !== "_headers"
)
await writeFile(
  path.join(directory, "offline-assets.json"),
  JSON.stringify(essential)
)
const { warnings, count, size } = await generateSW({
  globDirectory: directory,
  globPatterns: [
    "**/*.{html,js,css,json,webmanifest,ico,png,svg,woff,woff2,txt,rsc}",
  ],
  globIgnores: ["sw.js", "workbox-*.js"],
  swDest: path.join(directory, "sw.js"),
  maximumFileSizeToCacheInBytes: 15 * 1024 * 1024,
  directoryIndex: "index.html",
  ignoreURLParametersMatching: [
    /^id$/,
    /^novo$/,
    /^exercicio$/,
    /^utm_/,
    /^fbclid$/,
  ],
  skipWaiting: false,
  clientsClaim: true,
  cleanupOutdatedCaches: true,
  inlineWorkboxRuntime: true,
  sourcemap: false,
})
if (warnings.length) throw new Error(warnings.join("\n"))
// A build must never silently omit an essential file from the precache.
const worker = await readFile(path.join(directory, "sw.js"), "utf8")
for (const file of essential) {
  if (!worker.includes(file))
    throw new Error(`Arquivo ausente do precache: ${file}`)
}
console.log(`Offline: ${count} arquivos, ${(size / 1024 / 1024).toFixed(2)} MB`)
