// notifier 109 in the Firestore emulator (`npm run test:rules`): a revised spec (a newer spec
// brief comment while the need is still spec) or a different question on the same task notifies
// again, under the same tag. Any other change to the task while its decision is unchanged
// (comments, stage, updatedAt, working, lastCommentAt) sends nothing.
import { beforeEach, describe, expect, it } from 'vitest'
import type { Task } from '../../packages/shared/src/index.ts'
import { briefText } from '../fixtures/swipe-deck-brief.ts'
import {
  fakePush,
  patchTask,
  putComment,
  putTask,
  seedDevices,
  sentFor,
  settle,
  useNotifier,
  waitForSends,
} from '../fixtures/board-briefs-b7-emulator.ts'

const push = fakePush()
const db = useNotifier(push)
beforeEach(async () => {
  push.reset()
  await seedDevices(db(), ['tok-a'])
})

// What a session's write does: the comment, and the task's lastCommentAt/updatedAt with it.
async function post(task: Pick<Task, 'id' | 'projectId'>, body: string, at: number, james = false) {
  await putComment(db(), task, body, at, james ? { author: 'james', kind: 'comment' } : {})
  await patchTask(db(), task.id, { lastCommentAt: at, updatedAt: at })
}
const specTask = async (yes: string, t0: number) => {
  const task = await putTask(db(), { stage: 'spec' })
  await post(task, briefText('spec', { yes }), t0)
  await patchTask(db(), task.id, { needs: { kind: 'spec' } })
  await waitForSends(push, task.id, 1)
  return task
}

describe('notifier 109: a changed decision notifies again', () => {
  it('a revised spec notifies again under the same tag', async () => {
    const t0 = Date.now()
    const task = await specTask('First draft', t0)
    await post(task, briefText('spec', { yes: 'Second draft' }), t0 + 10)
    const calls = await waitForSends(push, task.id, 2)
    expect(calls.map((c) => [c.notice.tag, c.notice.body])).toEqual([
      [`decision:${task.id}`, 'First draft'],
      [`decision:${task.id}`, 'Second draft'],
    ])
  })

  it('a different question notifies again under the same tag as the spec before it', async () => {
    const task = await specTask('A spec', Date.now())
    await patchTask(db(), task.id, { needs: { kind: 'question', question: 'Which branch?' } })
    await waitForSends(push, task.id, 2)
    await patchTask(db(), task.id, { needs: { kind: 'question', question: 'And which font?' } })
    const calls = await waitForSends(push, task.id, 3)
    expect(calls.map((c) => [c.notice.tag, c.notice.title.split(' · ')[0], c.notice.body])).toEqual(
      [
        [`decision:${task.id}`, 'Spec', 'A spec'],
        [`decision:${task.id}`, 'Question', 'Which branch?'],
        [`decision:${task.id}`, 'Question', 'And which font?'],
      ]
    )
  })

  it('another task has its own tag', async () => {
    const a = await specTask('Task A', Date.now())
    const b = await specTask('Task B', Date.now())
    expect(sentFor(push, a.id).map((c) => c.notice.tag)).toEqual([`decision:${a.id}`])
    expect(sentFor(push, b.id).map((c) => c.notice.tag)).toEqual([`decision:${b.id}`])
  })
})

describe('notifier 109: nothing else sends', () => {
  it('changes to the task while its spec decision is unchanged send nothing', async () => {
    const t0 = Date.now()
    const task = await specTask('Quiet spec', t0)
    await patchTask(db(), task.id, { working: true })
    await patchTask(db(), task.id, { updatedAt: t0 + 1 })
    await patchTask(db(), task.id, { lastCommentAt: t0 + 2 })
    await patchTask(db(), task.id, { stage: 'approved' })
    await post(task, 'Still thinking about it.', t0 + 3)
    await post(task, 'Looks fine to me', t0 + 4, true)
    await post(task, briefText('spec', { yes: 'James pasted a spec' }), t0 + 5, true)
    await post(task, briefText('fix', { yes: 'A newer brief of another gate' }), t0 + 6)
    await post(task, '## Decision brief (spec)\nnot well formed', t0 + 7)
    await settle(db(), push)
    expect(sentFor(push, task.id)).toHaveLength(1)
  })

  it('changes to the task while its question is unchanged send nothing', async () => {
    const t0 = Date.now()
    const task = await putTask(db(), { needs: { kind: 'question', question: 'Same question?' } })
    await waitForSends(push, task.id, 1)
    await patchTask(db(), task.id, { working: true, updatedAt: t0 + 1 })
    await post(task, 'Same question?', t0 + 2)
    await patchTask(db(), task.id, { needs: { kind: 'question', question: 'Same question?' } })
    await patchTask(db(), task.id, { unread: true, stage: 'pr' })
    await settle(db(), push)
    expect(sentFor(push, task.id)).toHaveLength(1)
  })
})
