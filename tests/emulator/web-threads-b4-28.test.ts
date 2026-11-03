// web-threads shared criterion 28, the tick half, in the Firestore emulator (`npm run
// test:rules`): tickStep is a batch, not a transaction, so a tick made with no network shows in
// the local snapshot at once (pending), its promise waits, and it reaches the server when the
// network returns. Its history goes in with arrayUnion past LOG_CAP; the next transactional
// writer moves the overflow to log_archive.
import { describe, expect, it, vi } from 'vitest'
import {
  disableNetwork,
  doc,
  enableNetwork,
  onSnapshot,
  type DocumentReference,
  type DocumentSnapshot,
} from 'firebase/firestore'
import * as data from '../../packages/web/src/data.ts'
import {
  FULL_LOG,
  LOG_CAP,
  jamesDb,
  lastEntry,
  makeTask,
  readArchive,
  readTask,
  seedTask,
  useEmulator,
} from '../fixtures/web-threads-b4-emulator.ts'

vi.mock('../../packages/web/src/firebase.ts', async () =>
  (await import('../fixtures/web-threads-b4-emulator.ts')).firebaseModule()
)
vi.mock('../../packages/web/src/lib/log.ts', async () =>
  (await import('../fixtures/web-threads-b4-emulator.ts')).logModule()
)

const STEPS = ['Open the site on your phone', 'Check the logs are quiet']
const afterDeployTask = (over: Parameters<typeof makeTask>[1] = {}) =>
  makeTask('t1', {
    stage: 'after_deploy',
    needs: { kind: 'after_deploy' },
    afterDeploy: STEPS,
    afterDone: [false, false],
    ...over,
  })

// Resolves with the first snapshot of `ref` (metadata changes included) that satisfies `pred`.
function snapshotWhere(ref: DocumentReference, pred: (snap: DocumentSnapshot) => boolean) {
  let stop = () => {}
  const found = new Promise<DocumentSnapshot>((resolve, reject) => {
    stop = onSnapshot(
      ref,
      { includeMetadataChanges: true },
      (snap) => {
        if (pred(snap)) resolve(snap)
      },
      reject
    )
  })
  return { found, stop: () => stop() }
}

const ticked = (snap: DocumentSnapshot) =>
  snap.exists() && (snap.data() as { afterDone: boolean[] }).afterDone[0] === true

describe('B4-28 tickStep while offline', () => {
  useEmulator()

  it('shows the tick locally at once, waits, and lands when the network returns', async () => {
    const db = jamesDb()
    const task = await seedTask(afterDeployTask())
    const ref = doc(db, 'tasks', 't1')
    const online = snapshotWhere(ref, (s) => s.exists() && !s.metadata.fromCache)
    await online.found
    online.stop()

    const pending = snapshotWhere(ref, (s) => ticked(s) && s.metadata.hasPendingWrites)
    await disableNetwork(db)
    try {
      let settled = false
      const write = data.tickStep(task, 0).finally(() => {
        settled = true
      })
      const local = await pending.found
      const shown = local.data() as { afterDone: boolean[]; log: { text: string }[] }
      expect(shown.afterDone).toEqual([true, false])
      expect(shown.log.map((e) => e.text)).toEqual([`Step done: ${STEPS[0]}`])
      expect(settled).toBe(false)

      const synced = snapshotWhere(ref, (s) => ticked(s) && !s.metadata.hasPendingWrites)
      await enableNetwork(db)
      await write
      await synced.found
      synced.stop()
    } finally {
      pending.stop()
      await enableNetwork(db)
    }
    const stored = await readTask('t1')
    expect(stored.afterDone).toEqual([true, false])
    expect(lastEntry(stored)?.text).toBe(`Step done: ${STEPS[0]}`)
  })
})

describe('B4-28 tickStep history past LOG_CAP', () => {
  useEmulator()

  it('appends past the cap, and the next transactional write archives the overflow', async () => {
    const task = await seedTask(afterDeployTask({ log: FULL_LOG() }))
    await data.tickStep(task, 0)
    const afterTick = await readTask('t1')
    expect(afterTick.log).toHaveLength(LOG_CAP + 1)
    expect(lastEntry(afterTick)?.text).toBe(`Step done: ${STEPS[0]}`)

    // The session then asks a question; James answers it (a transactional writer).
    const asked = await seedTask({
      ...afterTick,
      id: 't1',
      needs: { kind: 'question', question: 'Which region?' },
    })
    await data.answerQuestion(asked, { label: 'Europe' })
    const stored = await readTask('t1')
    expect(stored.log).toHaveLength(LOG_CAP)
    expect(stored.log[0].text).toBe('Entry 2')
    expect(stored.log.slice(-2).map((e) => e.text)).toEqual([
      `Step done: ${STEPS[0]}`,
      'Answered Which region?: Europe',
    ])
    expect((await readArchive('t1')).map((e) => e.text)).toEqual(['Entry 0', 'Entry 1'])
  })
})
