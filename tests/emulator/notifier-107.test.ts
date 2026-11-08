// notifier 107 in the Firestore emulator (`npm run test:rules`): while the notifier runs and
// devices are registered, a task whose need becomes a spec - written by any agent version, through
// any path (here: the Admin SDK, no Board) - sends each device one notification equal to
// decisionNotice(task, <project name>, <latest spec brief>), where the latest spec brief is the
// body of the task's newest session comment that holds a well-formed spec brief (else none).
import { beforeEach, describe, expect, it } from 'vitest'
import { decisionNotice } from '../../packages/shared/src/index.ts'
import { briefText } from '../fixtures/swipe-deck-brief.ts'
import {
  NOTIFIER_PROJECT,
  fakePush,
  patchTask,
  putComment,
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
  await seedDevices(db(), ['tok-a', 'tok-b'])
})

const SPEC = { kind: 'spec' } as const
const storedNotified = async (id: string) =>
  (await db().collection('tasks').doc(id).get()).get('notified') as string | undefined

describe('notifier 107: a need that becomes a spec', () => {
  it('notifies each device once with the notice for the spec brief the session posted', async () => {
    const task = await putTask(db(), { stage: 'spec' })
    const body = briefText('spec', { yes: 'Start building the notifier' })
    await putComment(db(), task, body, Date.now())
    await patchTask(db(), task.id, { needs: SPEC })
    await waitForSends(push, task.id)
    await settle(db(), push)
    const calls = sentFor(push, task.id)
    expect(calls).toHaveLength(1)
    expect(calls[0].notice).toEqual(
      decisionNotice({ ...task, needs: SPEC }, NOTIFIER_PROJECT.name, body)
    )
    expect(calls[0].notice.title).toBe(`Spec · ${NOTIFIER_PROJECT.name}`)
    expect([...calls[0].tokens].sort()).toEqual(['tok-a', 'tok-b'])
  })

  it('a task written already waiting on a spec, with no spec brief, gets the title fallback', async () => {
    const task = await putTask(db(), { stage: 'spec', needs: SPEC })
    await waitForSends(push, task.id)
    await settle(db(), push)
    const calls = sentFor(push, task.id)
    expect(calls).toHaveLength(1)
    expect(calls[0].notice).toEqual(decisionNotice({ ...task }, NOTIFIER_PROJECT.name))
    expect(calls[0].notice.body).toBe(`Start building: ${task.title}`)
  })

  it('uses the newest session comment that holds a well-formed spec brief', async () => {
    const task = await putTask(db(), { stage: 'spec' })
    const t0 = Date.now()
    // Written newest-first so that only the comments' createdAt can tell which is newest.
    await putComment(db(), task, '### Decision brief (spec)\nnot a well formed brief', t0 + 6)
    await putComment(db(), task, briefText('fix', { yes: 'A fix brief' }), t0 + 5)
    await putComment(db(), task, 'Working on it, back soon.', t0 + 4)
    await putComment(db(), task, briefText('spec', { yes: 'James wrote this' }), t0 + 3, {
      author: 'james',
      kind: 'comment',
    })
    const newest = briefText('spec', { yes: 'The newest spec' })
    await putComment(db(), task, newest, t0 + 2)
    await putComment(db(), task, briefText('spec', { yes: 'An older spec' }), t0 + 1)
    await patchTask(db(), task.id, { needs: SPEC })
    const [call] = await waitForSends(push, task.id)
    expect(call.notice).toEqual(
      decisionNotice({ ...task, needs: SPEC }, NOTIFIER_PROJECT.name, newest)
    )
    expect(call.notice.body).toBe('The newest spec')
  })

  it('without a session spec brief the notice has no spec body, even if James pasted one', async () => {
    const task = await putTask(db(), { stage: 'spec' })
    await putComment(db(), task, briefText('spec', { yes: 'James wrote this' }), Date.now(), {
      author: 'james',
      kind: 'comment',
    })
    await patchTask(db(), task.id, { needs: SPEC })
    const [call] = await waitForSends(push, task.id)
    expect(call.notice.body).toBe(`Start building: ${task.title}`)
  })

  it('records the decision on the task: spec:<newest brief comment id>, else spec:none', async () => {
    const withBrief = await putTask(db(), { stage: 'spec' })
    const commentId = await putComment(db(), withBrief, briefText('spec'), Date.now())
    await patchTask(db(), withBrief.id, { needs: SPEC })
    const without = await putTask(db(), { stage: 'spec', needs: SPEC })
    await waitForSends(push, withBrief.id)
    await waitForSends(push, without.id)
    expect(await waitFor(() => storedNotified(withBrief.id), 'notified on the task')).toBe(
      `spec:${commentId}`
    )
    expect(await waitFor(() => storedNotified(without.id), 'notified on the task')).toBe(
      'spec:none'
    )
  })

  it('uses only the devices that hold a valid token', async () => {
    await seedDevices(db(), ['tok-a'])
    await db().collection('devices').doc('bad-empty').set({ token: '', createdAt: 1, updatedAt: 1 })
    await db().collection('devices').doc('bad-type').set({ token: 7, createdAt: 1, updatedAt: 1 })
    await db().collection('devices').doc('bad-none').set({ createdAt: 1, updatedAt: 1 })
    const task = await putTask(db(), { stage: 'spec', needs: SPEC })
    await waitForSends(push, task.id)
    await settle(db(), push)
    const calls = sentFor(push, task.id)
    expect(calls).toHaveLength(1)
    expect(calls[0].tokens).toEqual(['tok-a'])
  })
})
