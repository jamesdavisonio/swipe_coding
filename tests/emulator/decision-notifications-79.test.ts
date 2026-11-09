// decision-notifications 79 in the Firestore emulator (`npm run test:rules`): a session that
// reports a pull request ready to merge, after-deploy steps, a to-do, a comment or a finished
// task causes no notification from the notifier, even with devices registered.
import { beforeEach, describe, expect, it } from 'vitest'
import { forJamesTaskId } from '../../packages/shared/src/index.ts'
import {
  fakePush,
  readTask,
  seedDevices,
  sentFor,
  settle,
  taskAt,
  useBoard,
  useNotifier,
} from '../fixtures/board-briefs-b7-emulator.ts'

const push = fakePush()
const board = useBoard('dn-79')
const db = useNotifier(push)
beforeEach(async () => {
  push.reset()
  await seedDevices(db(), ['tok-a', 'tok-b'])
})

describe('decision-notifications 79: reports that stay silent', () => {
  it('a pull request ready to merge', async () => {
    const t = await taskAt(board(), 'feature', { stage: 'build' })
    await board().updateTask({ task_id: t.id, pr_url: 'https://github.com/x/y/pull/531' })
    expect((await readTask(board(), t.id)).needs).toBeNull() // waits on its checks (pr-ready 127)
    await settle(db(), push)
    expect(sentFor(push, t.id)).toHaveLength(0)
  })

  it('after-deploy steps', async () => {
    const t = await taskAt(board(), 'feature', {
      stage: 'main_ci',
      afterDeploy: ['Check the site'],
    })
    await board().setSubtask(t.id, 'main_ci', 'done')
    expect((await readTask(board(), t.id)).stage).toBe('after_deploy')
    await settle(db(), push)
    expect(sentFor(push, t.id)).toHaveLength(0)
  })

  it('a to-do', async () => {
    await board().todoForJames('Rotate the key')
    await settle(db(), push)
    expect(sentFor(push, forJamesTaskId(board().id.projectId))).toHaveLength(0)
  })

  it('a comment', async () => {
    const t = await taskAt(board(), 'feature', { stage: 'build' })
    await board().comment(t.id, 'Halfway there')
    await settle(db(), push)
    expect(sentFor(push, t.id)).toHaveLength(0)
  })

  it('a step in progress or done, other than the spec', async () => {
    const t = await taskAt(board(), 'feature', { stage: 'build' })
    await board().setSubtask(t.id, 'build', 'in_progress')
    await board().setSubtask(t.id, 'build', 'done')
    await settle(db(), push)
    expect(sentFor(push, t.id)).toHaveLength(0)
  })

  it('a finished task', async () => {
    const t = await taskAt(board(), 'chore', { stage: 'do' })
    await board().updateTask({ task_id: t.id, status: 'done', summary: 'All done.' })
    await settle(db(), push)
    expect(sentFor(push, t.id)).toHaveLength(0)
  })
})
