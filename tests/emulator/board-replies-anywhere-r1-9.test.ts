// board-replies-anywhere R1, criterion 9: kanban_answered_in_session { task_id, answer } records an
// answer James gave in the session's own chat: the task stops asking for him, the thread shows a
// session message (author agent) "James answered in the session: <answer>", and any James answer
// still waiting on that task is marked so no later watcher prints it (plain comments still wait).
// The task must be bound to this session and have an open question (needs.kind question); the
// answer is trimmed, 1-2000 characters. The real agent over stdio.
import { describe, expect, it } from 'vitest'
import { deliveryState } from '../../packages/shared/src/index.ts'
import {
  QUESTION,
  finished,
  postReply,
  readComment,
  readComments,
  readTask,
  replyLine,
  seedSession,
  seedTask,
  startWatcher,
  useBoardDb,
  useSession,
} from '../fixtures/board-replies-anywhere-emulator.ts'

const db = useBoardDb()
const session = useSession('r1-9')
const TOOL = 'kanban_answered_in_session'

// A task bound to this session, waiting on a question asked with kanban_ask.
async function askedTask(question = 'Which branch?') {
  const s = session()
  const { id } = await s.json<{ id: string }>('kanban_create_task', {
    title: 'R1-9',
    type: 'bugfix',
  })
  await s.json('kanban_ask', { task_id: id, question })
  return { id, projectId: s.projectId, agentId: s.agentId }
}

describe('R1-9 an answer given in the session', () => {
  it('is a listed tool taking task_id and answer, both required', async () => {
    const tool = (await session().tools()).find((t) => t.name === TOOL)
    expect(tool).toBeDefined()
    expect(Object.keys(tool!.inputSchema.properties ?? {}).sort()).toEqual(['answer', 'task_id'])
    expect([...(tool!.inputSchema.required ?? [])].sort()).toEqual(['answer', 'task_id'])
  })

  it('clears the question, posts the session message, and no watcher prints the board answer', async () => {
    const s = session()
    const task = await askedTask()
    const comment = await postReply(db(), task, 'comment', 'still looking')
    const waiting = await postReply(db(), task, 'answer', 'main, from the phone')

    const r = await s.call(TOOL, { task_id: task.id, answer: '  the release branch \n' })
    expect(r.isError).toBe(false)
    const { id } = JSON.parse(r.text) as { id: string }
    expect(JSON.parse(r.text)).toEqual({ id: expect.any(String) })

    expect((await readTask(db(), task.id)).needs).toBeNull()
    const note = (await readComments(db(), task.id)).find((c) => c.id === id)
    expect(note).toMatchObject({
      kind: 'info',
      body: 'James answered in the session: the release branch',
      deliveredAt: expect.any(Number),
    })
    expect(note!.author).toBe('agent')
    expect(deliveryState(await readComment(db(), waiting))).toBe('delivered')
    // Only answers are settled by it: a plain comment still waits for the watcher.
    expect((await readComment(db(), comment)).deliveredAt).toBeNull()

    const w = startWatcher(['--agent', s.agentId])
    const later = await postReply(db(), task, 'comment', 'thanks')
    const run = await finished(w)
    expect(run.lines).toEqual([
      replyLine(task.id, 'comment', comment, 'still looking'),
      replyLine(task.id, 'comment', later, 'thanks'),
    ])
  }, 40_000)

  it('takes an answer of exactly 2000 characters', async () => {
    const task = await askedTask()
    const r = await session().call(TOOL, { task_id: task.id, answer: 'x'.repeat(2000) })
    expect(r.isError).toBe(false)
    expect((await readTask(db(), task.id)).needs).toBeNull()
  })

  it.each([
    ['blank', '   '],
    ['2001 characters', 'x'.repeat(2001)],
  ])('refuses a %s answer and changes nothing', async (_n, answer) => {
    const task = await askedTask()
    const r = await session().call(TOOL, { task_id: task.id, answer })
    expect(r).toMatchObject({ isError: true, text: expect.stringMatching(/^invalid answer/) })
    expect((await readTask(db(), task.id)).needs).toEqual({
      kind: 'question',
      question: 'Which branch?',
    })
  })

  it.each([
    ['waits on nothing', null],
    ['waits on the spec, not a question', { kind: 'spec' }],
  ])('refuses a task that %s and leaves it as it was', async (_n, needs) => {
    const s = session()
    const { id } = await s.json<{ id: string }>('kanban_create_task', {
      title: 'R1-9',
      type: 'feature',
    })
    if (needs)
      await s.json('kanban_subtask', { task_id: id, key: 'spec', status: 'awaiting_approval' })
    const r = await s.call(TOOL, { task_id: id, answer: 'main' })
    expect(r).toMatchObject({ isError: true, text: expect.stringMatching(/^no open question/) })
    expect((await readTask(db(), id)).needs).toEqual(needs)
  })

  it('refuses a task bound to another session and leaves its question open', async () => {
    const s = session()
    const other = await seedSession(db(), { projectId: s.projectId })
    const task = await seedTask(db(), other, { needs: QUESTION })
    const r = await s.call(TOOL, { task_id: task.id, answer: 'main' })
    expect(r).toMatchObject({
      isError: true,
      text: expect.stringContaining('not bound to this session'),
    })
    expect((await readTask(db(), task.id)).needs).toEqual(QUESTION)
  })
})
