// swipe-deck 56: the site's Permissions-Policy allows the microphone for the site itself, and
// still withholds camera and geolocation. Reads the hosting config as deployed.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

interface Header {
  key: string
  value: string
}
const config = JSON.parse(
  readFileSync(join(import.meta.dirname, '..', 'firebase.json'), 'utf8')
) as {
  hosting: { headers: { source: string; headers: Header[] }[] }
}

describe('swipe-deck 56: Permissions-Policy', () => {
  const policy = config.hosting.headers
    .filter((h) => h.source === '**')
    .flatMap((h) => h.headers)
    .find((h) => h.key === 'Permissions-Policy')?.value

  it('allows the microphone for the site itself only', () => {
    expect(policy).toContain('microphone=(self)')
    expect(policy).not.toContain('microphone=()')
    expect(policy).not.toMatch(/microphone=\([^)]*\*/)
  })

  it('keeps the camera and geolocation off', () => {
    expect(policy).toContain('camera=()')
    expect(policy).toContain('geolocation=()')
  })
})
