import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, join, normalize, resolve } from 'node:path'
import { getLanAddress } from '../server/lanAddress.js'

// A static file server for the client, replacing `python3 -m http.server`.
//
// The reason it exists is caching. python3's server sends no cache headers
// at all, so browsers apply heuristic caching to the twenty-odd ES modules
// this game loads - and a plain reload can then serve a mix of old and new
// files. That produced real confusion: bugs reported as still present after
// they had been fixed, because the browser was still running the previous
// build. Everything here is sent with no-store.

const PORT = process.env.WEB_PORT || 8843
const ROOT = resolve(process.cwd())

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
}

function safePath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0])
  const relative = normalize(decoded).replace(/^(\.\.[/\\])+/, '')
  const full = join(ROOT, relative)
  // Never serve outside the project directory.
  return full.startsWith(ROOT) ? full : null
}

const MATCH_PORT = process.env.PORT || 8080

createServer(async (request, response) => {
  // The page cannot know the machine's LAN address on its own - it only sees
  // whatever hostname was typed, which is "localhost" for the host. Serving
  // it here lets the lobby show the address to hand to other players, and
  // pre-fill the manual server field with something real.
  if (request.url.split('?')[0] === '/server-info') {
    response.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    })
    response.end(JSON.stringify({ lanAddress: getLanAddress(), matchPort: Number(MATCH_PORT), webPort: Number(PORT) }))
    return
  }

  let filePath = safePath(request.url === '/' ? '/index.html' : request.url)
  if (!filePath) {
    response.writeHead(403).end('Forbidden')
    return
  }

  try {
    const info = await stat(filePath)
    if (info.isDirectory()) filePath = join(filePath, 'index.html')
    const body = await readFile(filePath)
    response.writeHead(200, {
      'Content-Type': MIME[extname(filePath)] ?? 'application/octet-stream',
      // The whole point of this file.
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
    })
    response.end(body)
  } catch {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Não encontrado')
  }
}).listen(PORT, () => {
  console.log(`AlmondegoUs — cliente em http://localhost:${PORT}`)
  console.log(`Outros jogadores na mesma rede: http://${getLanAddress()}:${PORT}`)
  console.log('Cache desativado: recarregar sempre traz a versão mais recente.')
})
