// board-replies-anywhere R1, criterion 7: a watcher that cannot deliver says why in one stdout line
// and exits with a failure code instead of waiting: board offline, unknown session, or a session
// whose agent has shut down (lastSeen 0) at start or while it waits; each stores a WARNING
// api_call_failed through logFailure (offline: only its stderr line, nothing can be stored). Arguments
// other than exactly `--agent <1-64 of [A-Za-z0-9_-]>` exit 2 before any board access. The watcher
// and the real agent spawned against the emulator.
import type { DocumentData } from 'firebase-admin/firestore'
import { describe, expect, it } from 'vitest'
import {
  finished,
  oneWatcherRun,
  seedSession,
  startSession,
  startWatcher,
  useBoardDb,
} from '../fixtures/board-replies-anywhere-emulator.ts'

const db = useBoardDb()

// The stored failure events with this status since `since`.
async function stored(status: string, since: number): Promise<DocumentData[]> {
  const snap = await db().collection('logs').where('context.status', '==', status).get()
  return snap.docs.map((d) => d.data()).filter((e) => (e.ts as number) >= since)
}
const warning = (target: string, status: string) =>
  expect.objectContaining({
    severity: 'WARNING',
    event_type: 'api_call_failed',
    source: 'server',
    context: expect.objectContaining({ target, status }),
  })

describe('R1-7 a watcher that cannot deliver fails loudly at once', () => {
  it('board offline: one line saying so, exit 1, the warning on stderr', async () => {
    const run = await finished(startWatcher(['--agent', 'someone'], { offline: true }))
    expect(run.lines).toHaveLength(1)
    expect(run.lines[0]).toMatch(/^kanban watcher: board offline: \S/)
    expect(run.code).toBe(1)
    // logFailure's log() line; nothing can be stored while the board is offline.
    expect(run.stderr).toContain('api_call_failed WARNING')
  })

  it('unknown session (a valid 64-character id): one line, exit 1, stored warning', async () => {
    const since = Date.now()
    const id = `${'a'.repeat(31)}_-${'Z9'.repeat(15)}x`
    expect(id).toHaveLength(64)
    const run = await finished(startWatcher(['--agent', id]))
    expect(run.lines).toEqual([`kanban watcher: unknown session ${id}`])
    expect(run.code).toBe(1)
    expect(await stored('unknown_session', since)).toContainEqual(
      warning('watcher', 'unknown_session')
    )
  })

  it('session already shut down at start: one line, exit 1, stored warning', async () => {
    const since = Date.now()
    const s = await seedSession(db(), { lastSeen: 0 })
    const run = await finished(startWatcher(['--agent', s.agentId]))
    expect(run.lines).toEqual([`kanban watcher: session ${s.agentId} has shut down`])
    expect(run.code).toBe(1)
    expect(await stored('shut_down', since)).toContainEqual(warning('watcher', 'shut_down'))
  })

  it('the session’s agent shuts down while the watcher waits: it stops at once, stored warning', async () => {
    const since = Date.now()
    const session = await startSession('r1-7')
    try {
      const w = startWatcher(['--agent', session.agentId])
      await oneWatcherRun(db())
      await session.close()
      const run = await finished(w, 10_000)
      expect(run.lines).toEqual([`kanban watcher: session ${session.agentId} has shut down`])
      expect(run.code).toBe(1)
      expect(await stored('shut_down', since)).toContainEqual(warning('watcher', 'shut_down'))
    } finally {
      await session.close()
    }
  }, 40_000)

  it.each([
    ['no arguments', []],
    ['--agent without an id', ['--agent']],
    ['an empty id', ['--agent', '']],
    ['an id with a space', ['--agent', 'a b']],
    ['an id with a slash', ['--agent', 'a/b']],
    ['a 65-character id', ['--agent', 'a'.repeat(65)]],
    ['two --agent', ['--agent', 'a', '--agent', 'b']],
    ['an extra argument', ['--agent', 'a', 'extra']],
    ['another flag', ['--session', 'a']],
  ])('invalid arguments (%s): one line, exit 2, before touching the board', async (_n, args) => {
    // Offline env: had it reached for the board first it would report the board instead.
    const run = await finished(startWatcher(args, { offline: true }))
    expect(run.lines).toHaveLength(1)
    expect(run.lines[0]).toMatch(/^kanban watcher: invalid arguments/)
    expect(run.code).toBe(2)
  })
})
