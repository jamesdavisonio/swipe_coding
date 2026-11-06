// board-replies-anywhere R1, criterion 1: the results of kanban_create_task and kanban_start_task
// keep their fields and add `watcher`, the exact command that starts this session's watcher
// (`node "<absolute wait.ts, forward slashes>" --agent <agentId>`), runnable from any folder.
// The real agent over stdio; the command itself run through a shell from a temporary folder.
import { isAbsolute, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  WAIT_TS,
  finished,
  postReply,
  replyLine,
  seedTask,
  startWatcher,
  useBoardDb,
  useSession,
} from '../fixtures/board-replies-anywhere-emulator.ts'

const db = useBoardDb()
const session = useSession('r1-1')

// The command names this session's agent and wait.ts by an absolute, forward-slash path.
function expectWatcherCommand(cmd: unknown, agentId: string) {
  const m = /^node "([^"]+)" --agent (\S+)$/.exec(String(cmd))
  expect(m, `watcher command ${JSON.stringify(cmd)}`).not.toBeNull()
  const [, script, agent] = m!
  expect(script).not.toContain('\\')
  expect(isAbsolute(script)).toBe(true)
  expect(resolve(script).toLowerCase()).toBe(resolve(WAIT_TS).toLowerCase())
  expect(agent).toBe(agentId)
}

describe('R1-1 task results carry the watcher command', () => {
  it('kanban_create_task: the task as before plus this session’s watcher', async () => {
    const s = session()
    const r = await s.json<Record<string, unknown>>('kanban_create_task', {
      title: 'R1-1 create',
      type: 'feature',
    })
    expect(r).toMatchObject({ type: 'feature', title: 'R1-1 create', stage: 'spec', mine: true })
    expect(r.needs).toBeNull()
    expect(typeof r.id).toBe('string')
    expectWatcherCommand(r.watcher, s.agentId)
  })

  it('kanban_start_task: the task as before plus this session’s watcher', async () => {
    const s = session()
    const queued = await seedTask(
      db(),
      { agentId: null, projectId: s.projectId },
      {
        createdBy: 'james',
      }
    )
    const r = await s.json<Record<string, unknown>>('kanban_start_task', { task_id: queued.id })
    expect(r).toMatchObject({ id: queued.id, type: 'feature', stage: 'spec', mine: true })
    expect(r.needs).toBeNull()
    expectWatcherCommand(r.watcher, s.agentId)
  })

  it('the command runs as given from another folder and prints the session’s reply', async () => {
    const s = session()
    const r = await s.json<{ id: string; watcher: string }>('kanban_create_task', {
      title: 'R1-1 run',
      type: 'chore',
    })
    const task = { id: r.id, projectId: s.projectId, agentId: s.agentId }
    const id = await postReply(db(), task, 'comment', 'carry on')
    const run = await finished(startWatcher([], { command: r.watcher }))
    expect(run.lines).toEqual([replyLine(r.id, 'comment', id, 'carry on')])
    expect(run.code).toBe(0)
  }, 30_000)
})
