// launch-session 125 in the Firestore emulator (`npm run test:rules`): a task without `launch`, or
// whose launch.state is anything but `requested`, starts nothing; editing a task (comments, stage,
// needs) never starts a session.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { putComment } from '../fixtures/board-briefs-b7-emulator.ts'
import {
  adminDb,
  barrier,
  callsFor,
  clearLaunchData,
  fakeLaunch,
  push,
  putLaunchTask,
  putProject,
  readLaunch,
  startWith,
  stopAll,
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

const STARTED = { state: 'started', requestedAt: 1_000, startedAt: 2_000, sessionId: 's-1' }
const FAILED = {
  state: 'failed',
  requestedAt: 1_000,
  failedAt: 2_000,
  reason: 'folder not found: x',
}

describe('launch-session 125: only a request starts a session', () => {
  it('tasks with no launch, a started launch or a failed launch start nothing', async () => {
    const p = await putProject(db)
    const none = await putLaunchTask(db, p, undefined)
    const started = await putLaunchTask(db, p, STARTED)
    const failed = await putLaunchTask(db, p, FAILED)
    await startWith(db, launch)
    const later = [
      await putLaunchTask(db, p, undefined),
      await putLaunchTask(db, p, STARTED),
      await putLaunchTask(db, p, FAILED),
    ]
    await barrier(db)
    for (const t of [none, started, failed, ...later])
      expect(callsFor(launch, t.id)).toHaveLength(0)
    expect(await readLaunch(db, started.id)).toEqual(STARTED)
    expect(await readLaunch(db, failed.id)).toEqual(FAILED)
    expect(await readLaunch(db, none.id)).toBeUndefined()
  })

  it('editing a task (stage, needs, comments) never starts a session', async () => {
    const p = await putProject(db)
    const none = await putLaunchTask(db, p, undefined)
    const started = await putLaunchTask(db, p, STARTED)
    const failed = await putLaunchTask(db, p, FAILED)
    await startWith(db, launch)
    for (const t of [none, started, failed]) {
      const ref = db.collection('tasks').doc(t.id)
      await ref.update({ stage: 'spec', updatedAt: Date.now() })
      await ref.update({ needs: { kind: 'spec' }, updatedAt: Date.now() })
      await putComment(db, t, 'A note while it works.', Date.now())
      await ref.update({ needs: null, stage: 'build', unread: true, working: true })
      await ref.update({ lastCommentAt: Date.now(), updatedAt: Date.now() })
    }
    await barrier(db)
    for (const t of [none, started, failed]) expect(callsFor(launch, t.id)).toHaveLength(0)
    expect(await readLaunch(db, started.id)).toEqual(STARTED)
    expect(await readLaunch(db, failed.id)).toEqual(FAILED)
    expect(await readLaunch(db, none.id)).toBeUndefined()
  })
})
