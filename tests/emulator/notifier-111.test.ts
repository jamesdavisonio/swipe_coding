// notifier 111 in the Firestore emulator (`npm run test:rules`): a decision is notified once. After
// the notifier restarts it does not send decisions it already sent, and a decision that appeared
// while it was not running is sent when it starts.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { startNotifier, type Notifier } from '../../packages/agent/src/notifier.ts'
import { adminDb } from '../fixtures/app-logs-emulator.ts'
import { briefText } from '../fixtures/swipe-deck-brief.ts'
import {
  clearDevices,
  fakePush,
  patchTask,
  putComment,
  putTask,
  seedDevices,
  sentFor,
  settle,
  waitForSends,
} from '../fixtures/board-briefs-b7-emulator.ts'

const push = fakePush()
let db: Awaited<ReturnType<typeof adminDb>>
const running: Notifier[] = []
const start = async () => {
  const n = await startNotifier({ db, push })
  running.push(n)
  return n
}
// Stops every notifier this test started (a stopped notifier releases the lease at once).
const stopAll = async () => {
  for (const n of running.splice(0)) await n.stop()
}

beforeAll(async () => {
  db = await adminDb()
})
beforeEach(async () => {
  await stopAll()
  await db.recursiveDelete(db.collection('notifier'))
  push.reset()
  await seedDevices(db, ['tok-a'])
})
afterAll(async () => {
  await stopAll()
  await clearDevices(db) // later suites must not find devices to send to
})

describe('notifier 111: once per decision, across restarts', () => {
  it('a restart does not send a decision it already sent', async () => {
    await start()
    const task = await putTask(db, { stage: 'spec', needs: { kind: 'spec' } })
    await waitForSends(push, task.id, 1)
    const q = await putTask(db, { needs: { kind: 'question', question: 'Once only?' } })
    await waitForSends(push, q.id, 1)
    await stopAll()
    await start()
    await settle(db, push)
    expect(sentFor(push, task.id)).toHaveLength(1)
    expect(sentFor(push, q.id)).toHaveLength(1)
  })

  it('a decision whose stored notified key already matches is not sent by a fresh notifier', async () => {
    // Written while no notifier runs, so only the stored key (not memory) can tell it was sent.
    const q = await putTask(db, { stage: 'build' })
    await patchTask(db, q.id, {
      needs: { kind: 'question', question: 'Seeded?' },
      notified: 'question:Seeded?',
    })
    const spec = await putTask(db, { stage: 'spec' })
    await patchTask(db, spec.id, { needs: { kind: 'spec' }, notified: 'spec:none' })
    await start()
    await settle(db, push)
    expect(sentFor(push, q.id)).toHaveLength(0)
    expect(sentFor(push, spec.id)).toHaveLength(0)
  })

  it('a decision that appeared while it was not running is sent once, when it starts', async () => {
    await start()
    await settle(db, push)
    await stopAll()
    const asked = await putTask(db, { needs: { kind: 'question', question: 'While you slept?' } })
    const spec = await putTask(db, { stage: 'spec' })
    await putComment(db, spec, briefText('spec', { yes: 'Written while stopped' }), Date.now())
    await patchTask(db, spec.id, { needs: { kind: 'spec' } })
    expect(sentFor(push, asked.id)).toHaveLength(0)
    await start()
    const sentSpec = await waitForSends(push, spec.id, 1)
    const sentQuestion = await waitForSends(push, asked.id, 1)
    expect(sentSpec[0].notice.body).toBe('Written while stopped')
    expect(sentQuestion[0].notice.title.split(' · ')[0]).toBe('Question')
    await settle(db, push)
    expect(sentFor(push, spec.id)).toHaveLength(1)
    expect(sentFor(push, asked.id)).toHaveLength(1)
  })

  it('a decision revised while it was not running is sent again when it starts', async () => {
    await start()
    const task = await putTask(db, { stage: 'spec' })
    await putComment(db, task, briefText('spec', { yes: 'Before the stop' }), Date.now())
    await patchTask(db, task.id, { needs: { kind: 'spec' } })
    await waitForSends(push, task.id, 1)
    await stopAll()
    const at = Date.now() + 10
    await putComment(db, task, briefText('spec', { yes: 'After the stop' }), at)
    await patchTask(db, task.id, { lastCommentAt: at, updatedAt: at })
    await start()
    const calls = await waitForSends(push, task.id, 2)
    expect(calls.map((c) => c.notice.body)).toEqual(['Before the stop', 'After the stop'])
  })
})
