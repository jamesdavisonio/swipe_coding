// launch-session 121 in the Firestore emulator (`npm run test:rules`): the notifier, while it holds
// the lease, starts one session for each task whose launch.state is `requested` and whose
// project's hostname is this PC's; tasks of projects on other PCs are left alone; requests made
// while it was not running are started too.
import { hostname } from 'node:os'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { NotifierBusyError, startNotifier } from '../../packages/agent/src/notifier.ts'
import {
  adminDb,
  barrier,
  callsFor,
  clearLaunchData,
  fakeLaunch,
  folder,
  launchState,
  push,
  putLaunchTask,
  putProject,
  requested,
  startWith,
  stopAll,
  waitFor,
  waitForState,
  type Db,
} from '../fixtures/launch-session-emulator.ts'

let db: Db
const launch = fakeLaunch()

beforeAll(async () => {
  db = await adminDb()
})
beforeEach(async () => {
  await stopAll()
  await clearLaunchData(db)
  launch.reset()
  push.reset()
})
afterAll(async () => {
  await stopAll()
  await clearLaunchData(db)
})

describe('launch-session 121: which requests the notifier starts', () => {
  it('starts one session for each requested task on this PC, in its project folder', async () => {
    const cwdA = folder('plain')
    const cwdB = folder('plain')
    const a = await putLaunchTask(db, await putProject(db, { cwd: cwdA }), requested())
    const b = await putLaunchTask(db, await putProject(db, { cwd: cwdB }), requested())
    await startWith(db, launch)
    await waitForState(db, a.id, 'started')
    await waitForState(db, b.id, 'started')
    expect(callsFor(launch, a.id)).toHaveLength(1)
    expect(callsFor(launch, b.id)).toHaveLength(1)
    expect(callsFor(launch, a.id)[0].cwd).toBe(cwdA)
    expect(callsFor(launch, b.id)[0].cwd).toBe(cwdB)
  })

  it('starts a request written while it is running', async () => {
    await startWith(db, launch)
    const p = await putProject(db)
    const t = await putLaunchTask(db, p, requested())
    await waitForState(db, t.id, 'started')
    expect(callsFor(launch, t.id)).toHaveLength(1)
  })

  it('starts a request made while it was not running, when it starts', async () => {
    const t = await putLaunchTask(db, await putProject(db, { cwd: folder('plain') }), requested())
    expect(await launchState(db, t.id)).toBe('requested')
    await startWith(db, launch)
    await waitForState(db, t.id, 'started')
    expect(callsFor(launch, t.id)).toHaveLength(1)
  })

  it('leaves the tasks of projects on other PCs alone', async () => {
    const other = await putProject(db, { host: `not-${hostname()}` })
    const before = await putLaunchTask(db, other, requested())
    await startWith(db, launch)
    const after = await putLaunchTask(db, other, requested())
    await barrier(db)
    expect(callsFor(launch, before.id)).toHaveLength(0)
    expect(callsFor(launch, after.id)).toHaveLength(0)
    expect(await launchState(db, before.id)).toBe('requested')
    expect(await launchState(db, after.id)).toBe('requested')
  })

  it('does not start anything while another notifier holds the lease', async () => {
    const t = await putLaunchTask(db, await putProject(db), requested())
    const lease = db.collection('notifier').doc('lease')
    await lease.set({ pid: 1, hostname: 'elsewhere', startedAt: Date.now(), lastSeen: Date.now() })
    await expect(startNotifier({ db, push, launch })).rejects.toBeInstanceOf(NotifierBusyError)
    expect(await launchState(db, t.id)).toBe('requested')
    // Once the foreign holder is gone a notifier on another port starts it; the busy one never did.
    await lease.delete()
    const second = fakeLaunch()
    await startWith(db, second)
    await waitForState(db, t.id, 'started')
    expect(callsFor(launch, t.id)).toHaveLength(0)
    expect(callsFor(second, t.id)).toHaveLength(1)
  })

  it('a stopped notifier starts nothing; the next one starts the request once', async () => {
    const n = await startWith(db, launch)
    await n.stop()
    const t = await putLaunchTask(db, await putProject(db), requested())
    expect(await launchState(db, t.id)).toBe('requested')
    const second = fakeLaunch()
    await startWith(db, second)
    await waitForState(db, t.id, 'started')
    expect(callsFor(launch, t.id)).toHaveLength(0)
    expect(callsFor(second, t.id)).toHaveLength(1)
  })

  it('a notifier that lost its lease starts nothing more', async () => {
    const lines: string[] = []
    const spy = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      lines.push(args.join(' '))
    })
    try {
      await startWith(db, launch, { heartbeatMs: 200 })
      // Another holder takes the lease over (stale, so a new notifier may take it from them).
      await db
        .collection('notifier')
        .doc('lease')
        .set({ pid: 1, hostname: 'elsewhere', startedAt: 1, lastSeen: 1 })
      // The first notifier notices (its own log line) before anything else happens.
      await waitFor(
        () =>
          Promise.resolve(
            lines.some((l) =>
              l.includes('notifier lost its lease to another notifier: no longer sending')
            )
          ),
        'the first notifier to log that it lost its lease'
      )
    } finally {
      spy.mockRestore()
    }
    // A request written while only the first (lost) notifier exists gets a head start on it.
    const t = await putLaunchTask(db, await putProject(db), requested())
    const second = fakeLaunch()
    await startWith(db, second)
    await waitForState(db, t.id, 'started')
    expect(callsFor(second, t.id)).toHaveLength(1)
    expect(callsFor(launch, t.id)).toHaveLength(0)
  })
})
