// swipe-deck 50, data side, in the Firestore emulator (`npm run test:rules`): requestMerge, the
// write behind the held merge button. While the task waits on its PR it clears the need (stage
// stays pr), records "Asked to merge PR #<n>" and sends James's message "Merge PR #<n> into
// main."; a second call, or a task not waiting on the PR, writes nothing.
import { describe, expect, it, vi } from 'vitest'
import * as data from '../../packages/web/src/data.ts'
import {
  expectUntouched,
  lastEntry,
  makeTask,
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
    stage: 'pr',
    needs: { kind: 'pr' },
    pr: { number: 24, url: 'https://github.com/x/y/pull/24' },
    ...over,
  })

describe('swipe-deck 50: requestMerge in the emulator', () => {
  useEmulator()

  it('clears the need, keeps stage pr, records the request and sends the merge message', async () => {
    const task = await seedTask(prTask())
    await data.requestMerge(task)
    const stored = await readTask('t1')
    expect(stored.stage).toBe('pr')
    expect(stored.needs).toBeNull()
    expect(lastEntry(stored)).toEqual(
      expect.objectContaining({ who: 'james', text: 'Asked to merge PR #24' })
    )
    const comments = await readComments('t1')
    expect(comments).toHaveLength(1)
    expect(comments[0]).toEqual(
      expect.objectContaining({
        taskId: 't1',
        agentId: 'agent-1',
        author: 'james',
        kind: 'comment',
        body: 'Merge PR #24 into main.',
        deliveredAt: null,
      })
    )
  })

  it('a second call writes nothing more', async () => {
    const task = await seedTask(prTask())
    await data.requestMerge(task)
    await data.requestMerge(task)
    expect(await readComments('t1')).toHaveLength(1)
    expect((await readTask('t1')).log).toHaveLength(1)
  })

  it('writes nothing when the task no longer waits on the PR', async () => {
    const task = await seedTask(prTask({ needs: null }))
    await data.requestMerge(prTask())
    await expectUntouched(task)
  })

  it('writes nothing outside stage pr', async () => {
    const task = await seedTask(prTask({ stage: 'merged' }))
    await data.requestMerge(task)
    await expectUntouched(task)
  })
})
