// web-threads B4, criterion 18, in the Firestore emulator (`npm run test:rules`): what
// markMerged stores when James says he merged the PR, read back as James through the real
// rules: stage merged, need cleared, history "Merged PR #<n>" ("Merged the PR" without a PR),
// James's message kind merged "Merged it.". A transaction guarded on stage pr.
import { describe, expect, it, vi } from 'vitest'
import * as data from '../../packages/web/src/data.ts'
import {
  FULL_LOG,
  LOG_CAP,
  expectUntouched,
  lastEntry,
  makeTask,
  readArchive,
  readComments,
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

const prTask = (over: Parameters<typeof makeTask>[1] = {}) =>
  makeTask('t1', {
    type: 'bugfix',
    stage: 'pr',
    needs: { kind: 'pr' },
    pr: { number: 42, url: 'https://github.com/nullnoise/kanban/pull/42' },
    ...over,
  })

describe('B4-18 markMerged in the emulator', () => {
  useEmulator()

  it('moves to merged, clears the need, records "Merged PR #<n>" and sends "Merged it."', async () => {
    const task = await seedTask(prTask())
    await data.markMerged(task)
    const stored = await readTask('t1')
    expect(stored.stage).toBe('merged')
    expect(stored.needs).toBeNull()
    expect(stored.log).toHaveLength(1)
    expect(lastEntry(stored)).toEqual(
      expect.objectContaining({ who: 'james', text: 'Merged PR #42' })
    )
    const comments = await readComments('t1')
    expect(comments).toHaveLength(1)
    expect(comments[0]).toEqual(
      expect.objectContaining({
        taskId: 't1',
        author: 'james',
        kind: 'merged',
        body: 'Merged it.',
      })
    )
    expect(stored.lastCommentAt).toBe(comments[0].createdAt)
  })

  it('records "Merged the PR" when the task has no PR', async () => {
    const task = await seedTask(prTask({ pr: null }))
    await data.markMerged(task)
    const stored = await readTask('t1')
    expect(stored.stage).toBe('merged')
    expect(lastEntry(stored)?.text).toBe('Merged the PR')
  })

  it('writes nothing outside stage pr (a stale screen)', async () => {
    const onScreen = prTask()
    const current = await seedTask(prTask({ stage: 'main_ci', needs: null }))
    await data.markMerged(onScreen)
    await expectUntouched(current)
  })

  it('a double tap writes once', async () => {
    const task = await seedTask(prTask())
    await data.markMerged(task)
    await data.markMerged(task)
    expect(await readComments('t1')).toHaveLength(1)
    expect((await readTask('t1')).log).toHaveLength(1)
  })

  it('moves the oldest history past LOG_CAP to log_archive in the same write', async () => {
    const task = await seedTask(prTask({ log: FULL_LOG() }))
    await data.markMerged(task)
    const stored = await readTask('t1')
    expect(stored.log).toHaveLength(LOG_CAP)
    expect(stored.log[0].text).toBe('Entry 1')
    expect(lastEntry(stored)?.text).toBe('Merged PR #42')
    expect((await readArchive('t1')).map((e) => e.text)).toEqual(['Entry 0'])
  })
})
