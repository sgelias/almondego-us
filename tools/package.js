// Builds the things a player downloads: a .deb for Ubuntu and a portable
// .tar.gz for everything else.
//
//   yarn package
//
// Both carry their own Node runtime. The alternative - Depends: nodejs -
// fails on Ubuntu 22.04, whose default nodejs is 12.x, and fails in the
// confusing way: apt installs something, the launcher dies on syntax it
// does not recognise. These go on other people's machines, so the build
// takes the size hit instead.
//
// Everything is copied, nothing is compiled. There is still no build step
// for the game itself (AD-003); this only gathers files and writes an
// archive around them.

import { execFileSync } from 'node:child_process'
import { cp, mkdir, mkdtemp, readFile, rm, writeFile, chmod, stat } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '..')
const OUT = join(ROOT, 'dist')

const NODE_VERSION = process.env.BUNDLE_NODE_VERSION ?? 'v22.11.0'
const NODE_ARCH = 'linux-x64'
const NODE_TARBALL = `node-${NODE_VERSION}-${NODE_ARCH}.tar.xz`
const NODE_URL = `https://nodejs.org/dist/${NODE_VERSION}/${NODE_TARBALL}`
// Downloaded once and kept, so rebuilding does not re-fetch 40 MB.
const CACHE = join(ROOT, '.cache')

// What a player needs at runtime. Deliberately a list rather than "copy
// everything except": a payload built by exclusion silently grows whatever
// lands in the repo next, and node_modules in particular would ship a
// second copy of three and leave it ambiguous which one the browser loads.
const PAYLOAD = [
  'index.html',
  'package.json',
  'src',
  'shared',
  'server',
  'tools/serve.js',
  'tools/dev.js',
  'vendor',
  'assets',
]

function run(command, args, options = {}) {
  return execFileSync(command, args, { stdio: 'inherit', ...options })
}

async function bundledNode() {
  await mkdir(CACHE, { recursive: true })
  const archive = join(CACHE, NODE_TARBALL)
  const extracted = join(CACHE, `node-${NODE_VERSION}-${NODE_ARCH}`)

  if (!existsSync(extracted)) {
    if (!existsSync(archive)) {
      console.log(`Baixando o Node ${NODE_VERSION}…`)
      run('curl', ['-fSL', '-o', archive, NODE_URL])
    }
    console.log('Extraindo o Node…')
    run('tar', ['-xJf', archive, '-C', CACHE])
  }
  const binary = join(extracted, 'bin', 'node')
  if (!existsSync(binary)) throw new Error(`o Node embutido não apareceu em ${binary}`)
  return binary
}

async function stagePayload(stage) {
  const appDir = join(stage, 'app')
  await mkdir(appDir, { recursive: true })

  for (const entry of PAYLOAD) {
    const from = join(ROOT, entry)
    if (!existsSync(from)) {
      // assets/ is legitimately optional - the game plays silently without
      // it - but a missing src/ is a broken build, so say which is which.
      if (entry === 'assets') {
        console.warn('Aviso: assets/ não existe; o pacote sai sem música.')
        continue
      }
      throw new Error(`falta do payload: ${entry}`)
    }
    await cp(from, join(appDir, entry), { recursive: true })
  }

  // ws is the only runtime dependency. Copying node_modules wholesale would
  // ship three twice.
  await mkdir(join(appDir, 'node_modules'), { recursive: true })
  await cp(join(ROOT, 'node_modules/ws'), join(appDir, 'node_modules/ws'), { recursive: true })

  const node = await bundledNode()
  await mkdir(join(stage, 'runtime', 'bin'), { recursive: true })
  await cp(node, join(stage, 'runtime', 'bin', 'node'))
  await chmod(join(stage, 'runtime', 'bin', 'node'), 0o755)

  return appDir
}

// The launcher. Starts the servers, waits for the page to answer, then opens
// a browser at it - so "run AlmondegoUs" is one action, not three.
function launcher(installRoot) {
  return `#!/bin/sh
set -e
HERE="${installRoot}"
NODE="$HERE/runtime/bin/node"
PORT="\${WEB_PORT:-8843}"

cd "$HERE/app"
WEB_PORT="$PORT" "$NODE" tools/dev.js &
SERVER_PID=$!
# Stop the servers when the launcher is closed, or a second run finds the
# port already taken and fails for a reason nobody can guess.
trap 'kill $SERVER_PID 2>/dev/null || true' EXIT INT TERM

# Wait for the page to actually answer rather than sleeping a fixed guess.
i=0
while [ $i -lt 50 ]; do
  if command -v curl >/dev/null 2>&1; then
    curl -sf -o /dev/null "http://localhost:$PORT/" && break
  else
    sleep 0.2
  fi
  i=$((i + 1))
  sleep 0.2
done

if command -v xdg-open >/dev/null 2>&1; then
  xdg-open "http://localhost:$PORT/" >/dev/null 2>&1 || true
else
  echo "Abra http://localhost:$PORT/ no navegador."
fi

wait $SERVER_PID
`
}

async function buildDeb(version, stage) {
  const debRoot = join(stage, 'deb')
  const installRoot = '/opt/almondegous'
  await mkdir(join(debRoot, 'DEBIAN'), { recursive: true })
  await mkdir(join(debRoot, 'opt'), { recursive: true })
  await mkdir(join(debRoot, 'usr/bin'), { recursive: true })
  await mkdir(join(debRoot, 'usr/share/applications'), { recursive: true })

  await cp(join(stage, 'app'), join(debRoot, installRoot.slice(1), 'app'), { recursive: true })
  await cp(join(stage, 'runtime'), join(debRoot, installRoot.slice(1), 'runtime'), { recursive: true })

  const size = Number(
    execFileSync('du', ['-sk', debRoot], { encoding: 'utf8' }).split(/\s+/)[0]
  )

  await writeFile(
    join(debRoot, 'DEBIAN/control'),
    // No Depends: the runtime is inside. Architecture is amd64 rather than
    // all precisely because of that bundled binary.
    `Package: almondegous
Version: ${version}
Section: games
Priority: optional
Architecture: amd64
Maintainer: sgelias <https://github.com/sgelias>
Installed-Size: ${size}
Description: AlmondegoUs - dedução social em primeira pessoa
 Um jogo de dedução social em primeira pessoa com tarefas educativas
 para crianças até ~10 anos. Roda no navegador, em rede local, e dá
 para jogar sozinho contra bots.
 .
 Traz o próprio runtime: não precisa instalar Node nem nada mais.
`
  )

  await writeFile(join(debRoot, 'usr/bin/almondegous'), launcher(installRoot))
  await chmod(join(debRoot, 'usr/bin/almondegous'), 0o755)

  await writeFile(
    join(debRoot, 'usr/share/applications/almondegous.desktop'),
    `[Desktop Entry]
Type=Application
Name=AlmondegoUs
Comment=Dedução social em primeira pessoa, com tarefas educativas
Exec=/usr/bin/almondegous
Terminal=false
Categories=Game;
`
  )

  await mkdir(OUT, { recursive: true })
  const debPath = join(OUT, `almondegous_${version}_amd64.deb`)
  // --root-owner-group avoids needing fakeroot for correct ownership.
  run('dpkg-deb', ['--root-owner-group', '--build', debRoot, debPath])
  return debPath
}

async function buildTarball(version, stage) {
  const name = `almondegous-${version}-linux-x64`
  const portable = join(stage, name)
  await mkdir(portable, { recursive: true })
  await cp(join(stage, 'app'), join(portable, 'app'), { recursive: true })
  await cp(join(stage, 'runtime'), join(portable, 'runtime'), { recursive: true })

  // A relative launcher, so the folder works wherever it is unpacked.
  await writeFile(join(portable, 'almondegous'), launcher('$(cd "$(dirname "$0")" && pwd)'))
  await chmod(join(portable, 'almondegous'), 0o755)
  await writeFile(
    join(portable, 'LEIA-ME.txt'),
    `AlmondegoUs ${version}

Para jogar:

    ./almondegous

Isso sobe o jogo e abre o navegador. Não precisa instalar nada - o Node
já vem junto.

Para jogar com mais gente na mesma rede: só uma máquina roda o comando.
As outras abrem, no navegador, o endereço que aparece no terminal e na
tela de entrada do jogo (algo como http://192.168.1.10:8843).
`
  )

  await mkdir(OUT, { recursive: true })
  const tarPath = join(OUT, `${name}.tar.gz`)
  run('tar', ['-czf', tarPath, '-C', stage, name])
  return tarPath
}

const { version } = JSON.parse(await readFile(join(ROOT, 'package.json'), 'utf8'))
if (!version) throw new Error('package.json não tem "version"')

const stage = await mkdtemp(join(tmpdir(), 'almondegous-pkg-'))
try {
  console.log(`Empacotando AlmondegoUs ${version}…`)
  await stagePayload(stage)
  const deb = await buildDeb(version, stage)
  const tarball = await buildTarball(version, stage)

  for (const file of [deb, tarball]) {
    const { size } = await stat(file)
    console.log(`  ${file.replace(ROOT + '/', '')}  ${(size / 1024 / 1024).toFixed(1)} MB`)
  }
} finally {
  await rm(stage, { recursive: true, force: true })
}
