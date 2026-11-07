// swipe-deck 57: readRemoteUrl reads ~/.claude/sessions/<pid>.json and returns the session's
// Claude link, or null for a missing file, unreadable JSON, a missing field or any other shape.
// Uses real temporary files.
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { readRemoteUrl } from '../packages/agent/src/remote.ts'

const dir = mkdtempSync(join(tmpdir(), 'swipe-deck-57-'))
afterAll(() => rmSync(dir, { recursive: true, force: true }))

const put = (pid: number, content: string) => writeFileSync(join(dir, `${pid}.json`), content)
let next = 1000
const withFile = (content: string): number => {
  put(++next, content)
  return next
}
const field = (value: unknown) => JSON.stringify({ pid: 1, bridgeSessionId: value })

describe('swipe-deck 57: readRemoteUrl', () => {
  it('returns the claude.ai link for a session_<id> bridge id', () => {
    const pid = withFile(
      JSON.stringify({ pid: 5, cwd: 'C:/x', bridgeSessionId: 'session_01AbC9xyz' })
    )
    expect(readRemoteUrl({ dir, pid })).toBe('https://claude.ai/code/session_01AbC9xyz')
  })

  it('accepts the pid as a string', () => {
    const pid = withFile(field('session_abc123'))
    expect(readRemoteUrl({ dir, pid: String(pid) })).toBe('https://claude.ai/code/session_abc123')
  })

  it('returns null for a missing file', () => {
    expect(readRemoteUrl({ dir, pid: 999_999 })).toBeNull()
    expect(readRemoteUrl({ dir: join(dir, 'nope'), pid: 1 })).toBeNull()
  })

  it.each([
    ['unreadable JSON', '{not json'],
    ['an empty file', ''],
    ['a missing field', JSON.stringify({ pid: 1 })],
    ['a null field', field(null)],
    ['a number', field(12)],
    ['an object', field({ id: 'session_a' })],
    ['an empty id', field('')],
    ['the prefix alone', field('session_')],
    ['another prefix', field('sess_abc')],
    ['a dash in the id', field('session_ab-c')],
    ['a path in the id', field('session_abc/../x')],
    ['a trailing newline', field('session_abc\n')],
    ['a leading space', field(' session_abc')],
    ['a JSON array', JSON.stringify(['session_abc'])],
    ['a JSON string', JSON.stringify('session_abc')],
    ['JSON null', 'null'],
  ])('returns null for %s', (_name, content) => {
    expect(readRemoteUrl({ dir, pid: withFile(content) })).toBeNull()
  })
})
