// pr-ready 133 (pure part): when gh cannot be run or fails, the real GithubPort rejects with an
// Error whose `code` is the spawn code (ENOENT) or exit_<n>, which the notifier stores as the
// status of its api_call_failed warning. Driven with node as the "gh" executable; never real gh.
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ghPort } from '../packages/agent/src/github.ts'

const URL = 'https://github.com/jamesdavisonio/kanban/pull/36'
const script = (body: string) => {
  const file = join(mkdtempSync(join(tmpdir(), 'pr-ready-gh-')), 'fake-gh.cjs')
  writeFileSync(file, body)
  return file
}

describe('pr-ready 133: the real GithubPort when gh fails', () => {
  it('a missing executable rejects with code ENOENT', async () => {
    const err = await ghPort({ command: join(tmpdir(), 'no-such-gh-executable') })
      .prStatus(URL)
      .catch((e: unknown) => e)
    expect(err).toBeInstanceOf(Error)
    expect((err as { code?: string }).code).toBe('ENOENT')
  })

  it('a non-zero exit rejects with code exit_<n>', async () => {
    const file = script(`console.error('gh auth login'); process.exit(4);`)
    const err = await ghPort({ command: process.execPath, prefixArgs: [file] })
      .prStatus(URL)
      .catch((e: unknown) => e)
    expect(err).toBeInstanceOf(Error)
    expect((err as { code?: string }).code).toBe('exit_4')
  })

  it('exit 1 is exit_1', async () => {
    const file = script(`process.exit(1);`)
    const err = await ghPort({ command: process.execPath, prefixArgs: [file] })
      .prStatus(URL)
      .catch((e: unknown) => e)
    expect((err as { code?: string }).code).toBe('exit_1')
  })
})
