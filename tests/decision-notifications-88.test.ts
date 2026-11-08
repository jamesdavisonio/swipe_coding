// decision-notifications 88: the deployed board's Content-Security-Policy lets the browser reach
// the push registration services, and the service worker file (/sw.js) is served uncached like the
// page, never with the immutable assets header. firebase.json is read as data, the way Firebase
// Hosting applies it; packages/web/public/sw.js must exist so Vite copies it to the site root.
import { existsSync, readFileSync } from 'node:fs'
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

// Later rules win for the same header key.
const headersFor = (path: string) => {
  const out: Record<string, string> = {}
  for (const r of rules) {
    const hit = r.regex ? new RegExp(`^(?:${r.regex})$`).test(path) : match(path, r.source ?? '')
    if (!hit) continue
    for (const h of r.headers) out[h.key.toLowerCase()] = h.value
  }
  return out
}
const directive = (csp: string, name: string) =>
  csp
    .split(';')
    .map((d) => d.trim().split(/\s+/))
    .find(([n]) => n === name)
    ?.slice(1) ?? []

describe('decision-notifications 88: hosting', () => {
  const csp = headersFor('/')['content-security-policy']

  it('connect-src allows the two push registration hosts', () => {
    const sources = directive(csp, 'connect-src')
    expect(sources).toContain('https://fcmregistrations.googleapis.com')
    expect(sources).toContain('https://firebaseinstallations.googleapis.com')
  })

  it('keeps the existing connect-src hosts', () => {
    const sources = directive(csp, 'connect-src')
    for (const host of [
      "'self'",
      'https://firestore.googleapis.com',
      'https://identitytoolkit.googleapis.com',
      'https://securetoken.googleapis.com',
      'https://www.googleapis.com',
    ])
      expect(sources).toContain(host)
  })

  it('serves /sw.js with Cache-Control no-cache, not the immutable assets header', () => {
    const cc = headersFor('/sw.js')['cache-control']
    expect(cc).toBe('no-cache')
    expect(cc).not.toContain('immutable')
  })

  it('still applies the security headers to /sw.js', () => {
    expect(headersFor('/sw.js')['content-security-policy']).toBe(csp)
    expect(headersFor('/sw.js')['x-content-type-options']).toBe('nosniff')
  })

  it('keeps /assets/ files immutable', () => {
    expect(headersFor('/assets/index-abc.js')['cache-control']).toBe(
      'public, max-age=31536000, immutable'
    )
  })

  it('has a sw.js in the web public folder, which Vite copies to the site root', () => {
    expect(existsSync(new URL('../packages/web/public/sw.js', import.meta.url))).toBe(true)
  })

  it('does not hide sw.js from Hosting', () => {
    for (const glob of config.hosting.ignore as string[]) expect(match('sw.js', glob)).toBe(false)
  })
})
