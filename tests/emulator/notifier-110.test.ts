// notifier 110 in the Firestore emulator (`npm run test:rules`): a need of pr, after_deploy or none
// sends nothing, and writes nothing on the task (a task with no decision gets no notified field).
import { beforeEach, describe, expect, it } from 'vitest'
import type { TaskNeed } from '../../packages/shared/src/index.ts'
import {
  fakePush,
  patchTask,
  putTask,
  seedDevices,
  sentFor,
  settle,
  useNotifier,
  waitFor,
  waitForSends,
} from '../fixtures/board-briefs-b7-emulator.ts'

const push = fakePush()
const db = useNotifier(push)
beforeEach(async () => {
  push.reset()
  await seedDevices(db(), ['tok-a'])
})

const stored = async (id: string) => (await db().collection('tasks').doc(id).get()).data()

describe('notifier 110: needs that are not decisions', () => {
  it.each([
    ['a pull request to merge', { kind: 'pr' }, 'pr'],
    ['after-deploy steps', { kind: 'after_deploy' }, 'after_deploy'],
    ['no need', null, 'build'],
  ] as [string, TaskNeed | null, 'pr' | 'after_deploy' | 'build'][])(
    '%s sends nothing and writes nothing',
    async (_n, needs, stage) => {
      const task = await putTask(db(), { stage, needs })
      await settle(db(), push)
      expect(sentFor(push, task.id)).toHaveLength(0)
      expect(await stored(task.id)).not.toHaveProperty('notified')
    }
  )

  it.each([
    ['a pull request', 'pr', { kind: 'pr' }],
    ['after-deploy steps', 'after_deploy', { kind: 'after_deploy' }],
    ['no need', 'build', null],
  ] as [string, 'pr' | 'after_deploy' | 'build', TaskNeed | null][])(
    'a need that changes to %s sends nothing more and removes notified',
    async (_n, stage, needs) => {
      const task = await putTask(db(), { stage: 'spec', needs: { kind: 'spec' } })
      await waitForSends(push, task.id, 1)
      await waitFor(
        async () => (await db().collection('tasks').doc(task.id).get()).get('notified') as string,
        'notified on the task'
      )
      await patchTask(db(), task.id, { stage, needs })
      await waitFor(async () => !(await stored(task.id))?.notified, 'notified to be removed')
      await settle(db(), push)
      expect(sentFor(push, task.id)).toHaveLength(1)
      expect(await stored(task.id)).not.toHaveProperty('notified')
    }
  )

  it('a re-posted spec with no new brief notifies again after the need was cleared', async () => {
    const task = await putTask(db(), { stage: 'spec', needs: { kind: 'spec' } })
    await waitForSends(push, task.id, 1)
    await waitFor(async () => (await stored(task.id))?.notified as string, 'notified on the task')
    await patchTask(db(), task.id, { needs: null })
    await waitFor(async () => !(await stored(task.id))?.notified, 'notified to be removed')
    await patchTask(db(), task.id, { needs: { kind: 'spec' } })
    await waitForSends(push, task.id, 2)
  })
})
