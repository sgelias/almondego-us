import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

// three.js is vendored into vendor/ and resolved by the import map in
// index.html, so the game runs with no internet at all - which is the point
// of an installable build for a room full of laptops on a flaky network.
//
// Nothing else in this repo can catch a broken import map. A wrong relative
// path is a black screen with a console error, and the browser is exactly
// what this session cannot run. So this walks the real module graph from the
// real entry point, resolving every specifier the way a browser would, and
// checks each resolved file actually exists. It is the difference between
// shipping a black screen to every installed machine and not.

const ROOT = resolve(import.meta.dirname, '..')

async function importMap() {
  const html = await readFile(join(ROOT, 'index.html'), 'utf8')
  const match = html.match(/<script type="importmap">([\s\S]*?)<\/script>/)
  assert.ok(match, 'index.html has no import map')
  return JSON.parse(match[1]).imports
}

// The same two rules a browser applies: an exact specifier match, then the
// longest trailing-slash prefix match.
function applyMap(specifier, imports) {
  if (imports[specifier]) return imports[specifier]
  let best = null
  for (const [prefix, target] of Object.entries(imports)) {
    if (!prefix.endsWith('/') || !specifier.startsWith(prefix)) continue
    if (!best || prefix.length > best.prefix.length) best = { prefix, target }
  }
  return best ? best.target + specifier.slice(best.prefix.length) : null
}

function collectSpecifiers(source) {
  const found = []
  // Static imports/exports, plus dynamic import(). Covers what three's
  // addons actually use.
  const patterns = [
    /(?:^|\n)\s*import\s+[^'"]*?from\s*['"]([^'"]+)['"]/g,
    /(?:^|\n)\s*import\s*['"]([^'"]+)['"]/g,
    /(?:^|\n)\s*export\s+[^'"]*?from\s*['"]([^'"]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ]
  for (const pattern of patterns) {
    for (const m of source.matchAll(pattern)) found.push(m[1])
  }
  return found
}

test('every module the page loads resolves to a file that exists', async () => {
  const imports = await importMap()
  const entry = join(ROOT, 'src/main.js')
  const seen = new Set([entry])
  const queue = [entry]
  const failures = []
  let resolvedBare = 0

  while (queue.length > 0) {
    const file = queue.pop()
    let source
    try {
      source = await readFile(file, 'utf8')
    } catch {
      continue
    }

    for (const specifier of collectSpecifiers(source)) {
      let target
      if (specifier.startsWith('.') || specifier.startsWith('/')) {
        target = resolve(dirname(file), specifier)
      } else {
        const mapped = applyMap(specifier, imports)
        if (!mapped) {
          failures.push(`${file.replace(ROOT, '.')}: bare specifier "${specifier}" is in no import map entry`)
          continue
        }
        resolvedBare += 1
        // Import-map targets are page-relative, so they resolve from the root.
        target = resolve(ROOT, mapped)
      }

      if (!existsSync(target)) {
        failures.push(`${file.replace(ROOT, '.')}: "${specifier}" resolves to ${target.replace(ROOT, '.')}, which is missing`)
        continue
      }
      if (!seen.has(target)) {
        seen.add(target)
        queue.push(target)
      }
    }
  }

  assert.deepEqual(failures, [], `unresolvable imports:\n  ${failures.join('\n  ')}`)
  // A guard on the guard: if the map stopped being consulted at all, every
  // path above would still "pass" by never being exercised.
  assert.ok(resolvedBare > 0, 'no bare specifier went through the import map - this test checked nothing')
  assert.ok(seen.size > 20, `only walked ${seen.size} modules; the graph walk is not reaching three`)
})

test('nothing the page loads comes from the network', async () => {
  const imports = await importMap()
  for (const [specifier, target] of Object.entries(imports)) {
    assert.ok(
      !/^https?:/.test(target),
      `"${specifier}" still points at ${target} - an installed copy would need internet to start`
    )
  }

  // And no module reaches out on its own.
  const html = await readFile(join(ROOT, 'index.html'), 'utf8')
  const remote = html.match(/(?:src|href)="https?:\/\/[^"]+"/g) ?? []
  assert.deepEqual(remote, [], `index.html loads remote resources: ${remote.join(', ')}`)
})
