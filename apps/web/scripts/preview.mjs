import http from "node:http"
import { readFile, stat } from "node:fs/promises"
import path from "node:path"

const root = path.resolve(process.env.PREVIEW_DIR || "out")
const port = Number(process.env.PORT || 4173)
const types = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".txt": "text/plain",
  ".woff2": "font/woff2",
}
http
  .createServer(async (request, response) => {
    try {
      const url = new URL(request.url, "http://localhost")
      let file = path.resolve(root, "." + decodeURIComponent(url.pathname))
      if (file !== root && !file.startsWith(root + path.sep)) {
        response.writeHead(403).end()
        return
      }
      if ((await stat(file)).isDirectory()) file = path.join(file, "index.html")
      const content = await readFile(file)
      response
        .writeHead(200, {
          "Content-Type": `${types[path.extname(file)] || "application/octet-stream"}; charset=utf-8`,
          "Cache-Control": "no-store",
        })
        .end(content)
    } catch {
      response.writeHead(404).end("Página não encontrada")
    }
  })
  .listen(port, "127.0.0.1", () =>
    console.log(`GymTrack: http://127.0.0.1:${port}`)
  )
