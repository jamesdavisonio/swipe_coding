// swipe-deck 64: every Hosting response outside /assets/ is no-cache; /assets/ stays immutable;
// the security headers still apply to every path.
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const minimatch = require('minimatch') as
  | ((p: string, g: string, o?: object) => boolean)
  | { minimatch: (p: string, g: string, o?: object) => boolean }
const match = (path: string, glob: string) =>
  (typeof minimatch === 'function' ? minimatch : minimatch.minimatch)(path, glob, { dot: true })

type Rule = { source?: string; regex?: string; headers: { key: string; value: string }[] }
const config = JSON.parse(readFileSync(new URL('../firebase.json', import.meta.url), 'utf8'))
const rules: Rule[] = config.hosting.headers

// Firebase Hosting: a rule matches by glob `source` or by `regex` (whole path); later rules win
// for the same header key.
const headersFor = (path: string) => {
  const out: Record<string, string> = {}
  for (const r of rules) {
    const hit = r.regex ? new RegExp(`^(?:${r.regex})$`).test(path) : match(path, r.source ?? '')
    if (!hit) continue
    for (const h of r.headers) out[h.key.toLowerCase()] = h.value
  }
  return out
}

describe('swipe-deck 64: hosting cache headers', () => {
  it.each(['/', '/index.html', '/t/abc123', '/projects'])('%s is no-cache', (path) => {
    expect(headersFor(path)['cache-control']).toBe('no-cache')
  })

  it('keeps /assets/ files long-lived and immutable', () => {
    const cc = headersFor('/assets/index-abc.js')['cache-control']
    expect(cc).toBe('public, max-age=31536000, immutable')
    expect(cc).not.toContain('no-cache')
  })

  it('still sends every security header on /', () => {
    const h = headersFor('/')
    for (const key of [
      'strict-transport-security',
      'x-content-type-options',
      'x-frame-options',
      'referrer-policy',
      'permissions-policy',
      'content-security-policy',
    ]) {
      expect(h[key], key).toBeTruthy()
    }
  })
})
