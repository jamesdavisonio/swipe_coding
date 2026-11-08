// notifier 114 in the Firestore emulator (`npm run test:rules`): only one notifier sends. A second
// one started while the first is live sends nothing and fails with NotifierBusyError (the CLI
// exits with that message); when the live one stops, or its lease is older than the lease time
// (default 2 minutes), a new one takes over. The lease is the document notifier/lease
// { pid, hostname, startedAt, lastSeen }; `now` and `leaseMs` are injected.
import { spawn } from 'node:child_process'
import { hostname } from 'node:os'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import {
  NotifierBusyError,
  startNotifier,
  type Notifier,
} from '../../packages/agent/src/notifier.ts'
import { adminDb } from '../fixtures/app-logs-emulator.ts'
import {
  clearDevices,
  fakePush,
  putTask,
  seedDevices,
  sentFor,
  waitFor,
  waitForSends,
} from '../fixtures/board-briefs-b7-emulator.ts'

type Db = Awaited<ReturnType<typeof adminDb>>
let db: Db
const running: Notifier[] = []
const pushA = fakePush()
const pushB = fakePush()
const clock = { t: Date.now() }
const now = () => clock.t
const lease = () => db.collection('notifier').doc('lease')

async function start(push = pushA, leaseMs?: number, heartbeatMs?: number) {
  const n = await startNotifier({
    db,
    push,
    now,
    ...(leaseMs === undefined ? {} : { leaseMs }),
    ...(heartbeatMs === undefined ? {} : { heartbeatMs }),
  })
  running.push(n)
  return n
}
const stopAll = async () => {
  for (const n of running.splice(0)) await n.stop()
}
const putLease = (lastSeen: number) =>
  lease().set({ pid: 1, hostname: 'elsewhere', startedAt: lastSeen - 5_000, lastSeen })

beforeAll(async () => {
  db = await adminDb()
})
beforeEach(async () => {
  await stopAll()
  await lease().delete()
  pushA.reset()
  pushB.reset()
  clock.t = Date.now()
  await seedDevices(db, ['tok-a'])
})
afterAll(async () => {
  await stopAll()
  await lease().delete()
  await clearDevices(db) // later suites must not find devices to send to
})

describe('notifier 114: one sender', () => {
  it('records its lease: pid, hostname, startedAt and lastSeen from the injected clock', async () => {
    await start()
    const stored = (await lease().get()).data()
    expect(stored).toEqual({
      pid: process.pid,
      hostname: hostname(),
      startedAt: clock.t,
      lastSeen: clock.t,
    })
  })

  it('a second notifier fails with NotifierBusyError and sends nothing; the first still sends', async () => {
    await start(pushA)
    const second = startNotifier({ db, push: pushB, now })
    await expect(second).rejects.toBeInstanceOf(NotifierBusyError)
    await expect(second).rejects.toThrow(/another notifier/i)
    const t = await putTask(db, { needs: { kind: 'question', question: 'Who sends?' } })
    const calls = await waitForSends(pushA, t.id)
    expect(calls).toHaveLength(1)
    expect(sentFor(pushB, t.id)).toHaveLength(0)
    expect(pushB.calls).toHaveLength(0)
  })

  it('stopping the live notifier removes the lease and lets a new one start', async () => {
    const first = await start(pushA)
    await first.stop()
    running.length = 0
    expect((await lease().get()).exists).toBe(false)
    await start(pushB)
    const t = await putTask(db, { needs: { kind: 'question', question: 'Who sends now?' } })
    await waitForSends(pushB, t.id)
    expect(sentFor(pushA, t.id)).toHaveLength(0)
  })

  it('a lease last seen within 2 minutes is live: a new notifier is refused', async () => {
    await putLease(clock.t - 119_000)
    await expect(startNotifier({ db, push: pushB, now })).rejects.toBeInstanceOf(NotifierBusyError)
    expect((await lease().get()).get('pid')).toBe(1)
  })

  it('a lease older than 2 minutes is taken over', async () => {
    await putLease(clock.t - 121_000)
    await start(pushB)
    expect(
      await lease()
        .get()
        .then((s) => s.data())
    ).toMatchObject({
      pid: process.pid,
      startedAt: clock.t,
      lastSeen: clock.t,
    })
    const t = await putTask(db, { needs: { kind: 'question', question: 'Taken over?' } })
    await waitForSends(pushB, t.id)
  })

  it('leaseMs sets how old a lease may be before it is taken over', async () => {
    await putLease(clock.t - 5_000)
    await expect(startNotifier({ db, push: pushB, now, leaseMs: 10_000 })).rejects.toBeInstanceOf(
      NotifierBusyError
    )
    await putLease(clock.t - 11_000)
    await start(pushB, 10_000)
    expect((await lease().get()).get('pid')).toBe(process.pid)
  })

  it('two notifiers started together: exactly one starts, and each decision is sent once', async () => {
    const results = await Promise.allSettled([
      startNotifier({ db, push: pushA, now }),
      startNotifier({ db, push: pushB, now }),
    ])
    for (const r of results) if (r.status === 'fulfilled') running.push(r.value)
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    const lost = results.find((r) => r.status === 'rejected')
    expect((lost as PromiseRejectedResult).reason).toBeInstanceOf(NotifierBusyError)
    const t = await putTask(db, { needs: { kind: 'question', question: 'Only one?' } })
    await waitFor(
      () => Promise.resolve(sentFor(pushA, t.id).length + sentFor(pushB, t.id).length >= 1),
      'the decision to be sent'
    )
    const b = await putTask(db, { needs: { kind: 'question', question: 'Barrier?' } })
    await waitFor(
      () => Promise.resolve(sentFor(pushA, b.id).length + sentFor(pushB, b.id).length >= 1),
      'the barrier to be sent'
    )
    expect(sentFor(pushA, t.id).length + sentFor(pushB, t.id).length).toBe(1)
  })

  it('the heartbeat keeps the lease live past leaseMs, so a new notifier is still refused', async () => {
    const leaseMs = 10_000
    const first = clock.t
    await start(pushA, leaseMs, 25)
    expect((await lease().get()).get('lastSeen')).toBe(first)
    clock.t = first + 3 * leaseMs
    await waitFor(
      async () => (await lease().get()).get('lastSeen') === clock.t,
      'the heartbeat to refresh lastSeen'
    )
    await expect(
      startNotifier({ db, push: pushB, now, leaseMs, heartbeatMs: 25 })
    ).rejects.toBeInstanceOf(NotifierBusyError)
  })
})

describe('notifier 114: a holder that was killed', () => {
  // A process of this host that has exited: its pid is no longer running.
  async function deadPid(): Promise<number> {
    const child = spawn(process.execPath, ['-e', ''])
    await new Promise((r) => child.once('exit', r))
    if (child.pid === undefined) throw new Error('the child never started')
    return child.pid
  }

  it('a fresh lease of this host whose pid is gone is free: a new notifier takes over', async () => {
    await lease().set({
      pid: await deadPid(),
      hostname: hostname(),
      startedAt: clock.t - 1_000,
      lastSeen: clock.t,
    })
    await start(pushB)
    expect((await lease().get()).get('pid')).toBe(process.pid)
    const t = await putTask(db, { needs: { kind: 'question', question: 'After the kill?' } })
    await waitForSends(pushB, t.id)
  })

  it('a fresh lease of this host whose pid is still running is live', async () => {
    const alive = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 60000)'])
    try {
      await lease().set({
        pid: alive.pid,
        hostname: hostname(),
        startedAt: clock.t - 1_000,
        lastSeen: clock.t,
      })
      await expect(startNotifier({ db, push: pushB, now })).rejects.toBeInstanceOf(
        NotifierBusyError
      )
    } finally {
      alive.kill()
    }
  })
})
