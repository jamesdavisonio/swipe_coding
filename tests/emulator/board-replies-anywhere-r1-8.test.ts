// board-replies-anywhere R1, criterion 8: the agent no longer pushes James's comments and answers
// into its session as channel events and never marks them received itself, so a session started
// with the channel option gets them through its watcher like any other; queued-task announcements
// still arrive on the channel, and kanban_start_task still reroutes a task's waiting replies to the
// session that takes it. The real agent over stdio (channel capability on) and the watcher.
import { describe, expect, it } from 'vitest'
import { initialTaskFields } from '../../packages/shared/src/index.ts'
import {
  QUESTION,
  finished,
  postReply,
  readTask,
  replyLine,
  seedSession,
  seedTask,
  startWatcher,
  useBoardDb,
  useSession,
  type Notice,
} from '../fixtures/board-replies-anywhere-emulator.ts'

const db = useBoardDb()
const session = useSession('r1-8')
const fromJames = (n: Notice) =>
  n.method === 'notifications/claude/channel' && n.params?.meta?.from === 'james'

describe('R1-8 the agent leaves replies to the watcher', () => {
  it('no channel push and no marking by the agent; queued announcements unchanged', async () => {
    const s = session()
    const { id } = await s.json<{ id: string }>('kanban_create_task', {
      title: 'R1-8 channel',
      type: 'feature',
    })
    await s.json('kanban_ask', { task_id: id, question: 'Which branch?' })
    const task = { id, projectId: s.projectId, agentId: s.agentId }
    const comment = await postReply(db(), task, 'comment', 'looking now')
    const answer = await postReply(db(), task, 'answer', 'main')

    // The agent's listeners are live: a task James queues afterwards is still announced.
    const queued = db().collection('tasks').doc()
    await queued.set(
      initialTaskFields({
        projectId: s.projectId,
        type: 'chore',
        title: 'R1-8 queued',
        description: '',
        createdBy: 'james',
        afterDeploy: [],
        now: Date.now(),
      })
    )
    await s.notice(
      (n) => n.params?.meta?.kind === 'queued' && n.params.meta.task === queued.id,
      'queued announcement'
    )
    expect(s.notices().filter(fromJames)).toEqual([])
    expect((await readTask(db(), id)).needs).toEqual({
      kind: 'question',
      question: 'Which branch?',
    })

    const run = await finished(startWatcher(['--agent', s.agentId]))
    expect(s.notices().filter(fromJames)).toEqual([])
    expect(run.lines).toEqual([
      replyLine(id, 'comment', comment, 'looking now'),
      replyLine(id, 'answer', answer, 'main'),
    ])
    expect(run.code).toBe(0)
  }, 40_000)

  it('kanban_start_task reroutes a left-behind task’s waiting reply to this session’s watcher', async () => {
    const s = session()
    const gone = await seedSession(db(), { projectId: s.projectId, lastSeen: 0 })
    const task = await seedTask(db(), gone, { working: false, needs: QUESTION })
    const reply = await postReply(db(), task, 'answer', 'use the release branch')

    const r = await s.json<{ watcher: string }>('kanban_start_task', { task_id: task.id })
    const run = await finished(startWatcher([], { command: r.watcher }))
    expect(run.lines).toEqual([replyLine(task.id, 'answer', reply, 'use the release branch')])
    expect(run.code).toBe(0)
    expect(s.notices().filter(fromJames)).toEqual([])
  }, 40_000)
})
