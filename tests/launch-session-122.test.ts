// launch-session 122, the argument array the real port gives the `claude` executable: --bg,
// --remote-control <name>, -n <name>, then -w <worktree> when there is one, then the first message
// as the last element. Every value is one element, so no title or description can run a command
// (the port passes the array to the executable, never through a shell).
import { existsSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { claudeArgs, claudeLaunchPort } from '../packages/agent/src/launcher.ts'

const req = (over: Partial<Parameters<typeof claudeArgs>[0]> = {}) => ({
  cwd: '/work/kanban',
  name: 'Add the search page',
  worktree: 'launch-abc123' as string | null,
  prompt: 'Take task abc123 with kanban_start_task.',
  ...over,
})

describe('launch-session 122: claudeArgs', () => {
  it('with a worktree: --bg, --remote-control <name>, -n <name>, -w <worktree>, the prompt last', () => {
    expect(claudeArgs(req())).toEqual([
      '--bg',
      '--remote-control',
      'Add the search page',
      '-n',
      'Add the search page',
      '-w',
      'launch-abc123',
      'Take task abc123 with kanban_start_task.',
    ])
  })

  it('without a worktree there is no -w', () => {
    expect(claudeArgs(req({ worktree: null }))).toEqual([
      '--bg',
      '--remote-control',
      'Add the search page',
      '-n',
      'Add the search page',
      'Take task abc123 with kanban_start_task.',
    ])
  })

  it('a title holding shell characters stays one element each time it appears', () => {
    const name = '"; rm -rf ~ & echo'
    const args = claudeArgs(req({ name }))
    expect(args).toHaveLength(8)
    expect(args[2]).toBe(name)
    expect(args[4]).toBe(name)
    expect(args.filter((a) => a === name)).toHaveLength(2)
  })

  it('a prompt full of shell characters and flags is the single last element', () => {
    const prompt = '$(whoami) `id` | cat ; && --dangerously-skip-permissions\n"quoted" \'x\' %PATH%'
    const args = claudeArgs(req({ prompt }))
    expect(args).toHaveLength(8)
    expect(args[args.length - 1]).toBe(prompt)
    expect(args.slice(0, -1)).not.toContain('--dangerously-skip-permissions')
  })

  it('does not put the folder in the arguments (it is where the process runs)', () => {
    expect(claudeArgs(req())).not.toContain('/work/kanban')
  })
})

// The real port, driven with node as the "claude" executable and a fake script as its first
// argument (prefixArgs). The script records its argv and cwd next to itself.
const dir = () => mkdtempSync(join(tmpdir(), 'launch-port-'))
function script(body: string): { file: string; record: () => { argv: string[]; cwd: string } } {
  const d = dir()
  const file = join(d, 'fake-claude.cjs')
  writeFileSync(
    file,
    `const fs = require('fs'), path = require('path');
fs.writeFileSync(path.join(__dirname, 'record.json'), JSON.stringify({ argv: process.argv.slice(2), cwd: process.cwd() }));
${body}`
  )
  return { file, record: () => JSON.parse(readFileSync(join(d, 'record.json'), 'utf8')) }
}
const OK = `const a = process.argv.slice(2); console.log('backgrounded · sess-77 · ' + a[a.indexOf('-n') + 1]);`

describe('launch-session 122: the real port', () => {
  it('runs the command with prefixArgs then claudeArgs, in the folder, and resolves the session id', async () => {
    const fake = script(OK)
    const cwd = dir()
    const r = req({ cwd, worktree: 'launch-abc123' })
    const out = await claudeLaunchPort({
      command: process.execPath,
      prefixArgs: [fake.file],
    }).start(r)
    expect(out.sessionId).toBe('sess-77')
    const seen = fake.record()
    expect(seen.argv).toEqual(claudeArgs(r))
    expect(realpathSync(seen.cwd)).toBe(realpathSync(cwd))
  })

  it('a title with shell syntax arrives intact and runs nothing', async () => {
    const fake = script(OK)
    const cwd = dir()
    const r = req({ cwd, name: '& echo x > pwned', prompt: '$(touch pwned2) ; echo y > pwned3' })
    await claudeLaunchPort({ command: process.execPath, prefixArgs: [fake.file] }).start(r)
    expect(fake.record().argv).toEqual(claudeArgs(r))
    for (const f of ['pwned', 'pwned2', 'pwned3']) {
      expect(existsSync(join(cwd, f))).toBe(false)
      expect(existsSync(join(process.cwd(), f))).toBe(false)
    }
  })

  it('a non-zero exit rejects with code exit_<n> and the last error line as the message', async () => {
    const fake = script(
      `console.error('first line'); console.error('Not logged in'); console.error(''); process.exit(3);`
    )
    const err = await claudeLaunchPort({ command: process.execPath, prefixArgs: [fake.file] })
      .start(req({ cwd: dir() }))
      .catch((e: unknown) => e)
    expect(err).toBeInstanceOf(Error)
    expect((err as { code?: string }).code).toBe('exit_3')
    expect((err as Error).message).toBe('Not logged in')
  })

  it('a missing executable rejects with code ENOENT', async () => {
    const err = await claudeLaunchPort({ command: join(dir(), 'no-such-claude') })
      .start(req({ cwd: dir() }))
      .catch((e: unknown) => e)
    expect(err).toBeInstanceOf(Error)
    expect((err as { code?: string }).code).toBe('ENOENT')
  })
})
