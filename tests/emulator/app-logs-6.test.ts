// app-logs L1, criterion 6: when the agent hits a failure it still writes its stderr and agent.log
// line, and also stores a WARNING or ERROR event with source `server`, its agent id and project
// id, and the task id when there is one. Failures reached through the real agent over stdio
// against the emulator (`npm run test:rules`):
// - a tool call that throws something other than BoardError (kanban_get_task with a task id that
//   is not a document path) → ERROR feature_error, context.feature = the tool name;
// (A failed channel delivery was the second site until 2026-11-06: replies now reach the session
// through the watcher, whose failures board-replies-anywhere R1-7 covers; case removed with
// James's approval.)
// A BoardError (a task that does not exist) and ordinary progress are not stored. The stored
// fields of logFailure itself (caller's request id, caps) are checked in-process at the end.
import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import taxonomy from '../../logging/taxonomy.json'
import {
  AGENT_LOG,
  RETENTION,
  STORED_KEYS,
  agentLogs,
  clearLogs,
  useAgent,
  waitForLog,
} from '../fixtures/app-logs-emulator.ts'

const agent = useAgent('6')
const whoami = () => agent().json<{ agentId: string; projectId: string }>('kanban_whoami')
const mine = (agentId: string) => (e: { source?: string; session_id?: string }) =>
  e.source === 'server' && e.session_id === agentId

describe('L1-6 the agent stores its failures', () => {
  it('a failed tool call: ERROR feature_error with agent, project and the line in its logs', async () => {
    await clearLogs()
    const { agentId, projectId } = await whoami()
    const res = await agent().call('kanban_get_task', { task_id: 'a/b' })
    expect(res.isError).toBe(true)
    const e = await waitForLog(
      (d) => d.event_type === 'feature_error' && d.context?.feature === 'kanban_get_task',
      'feature_error for kanban_get_task'
    )
    expect(Object.keys(e).sort()).toEqual(STORED_KEYS)
    expect(e).toEqual(
      expect.objectContaining({
        severity: 'ERROR',
        source: 'server',
        schema_version: 1,
        taxonomy_version: taxonomy.taxonomy_version,
        app_id: 'kanban',
        client_id: 'jamesdavisonio',
        env: 'prod',
        audience: 'internal',
        session_id: agentId,
        trace_id: null,
        user_id: null,
        request_id: expect.stringMatching(/^agent-[0-9a-f-]{36}$/),
        context: expect.objectContaining({
          feature: 'kanban_get_task',
          agent_id: agentId,
          project_id: projectId,
        }),
      })
    )
    expect(e.message).toBe(res.text)
    expect(e.message).not.toMatch(/\n\s+at /) // no stack
    expect(e.ts).toBe(Date.parse(e.timestamp))
    expect(e.expireAt.toMillis()).toBe(e.ts + RETENTION)
    // Still on stderr and in agent.log.
    expect(agent().stderr()).toContain('kanban_get_task')
    const lines = readFileSync(AGENT_LOG, 'utf8').split('\n')
    expect(lines.some((l) => l.includes(`[${agent().pid}]`) && l.includes('kanban_get_task'))).toBe(
      true
    )
  })

  it('a BoardError and ordinary progress are not stored', async () => {
    await clearLogs()
    const { agentId } = await whoami()
    expect((await agent().call('kanban_get_task', { task_id: 'no-such-task' })).isError).toBe(true)
    expect((await agent().call('kanban_list_tasks')).isError).toBe(false)
    const created = await agent().json<{ id: string }>('kanban_create_task', {
      title: 'App logs probe',
      type: 'chore',
    })
    expect(created.id).toBeTruthy()
    // A failure stored after them: anything they stored would be there by now.
    await agent().call('kanban_get_task', { task_id: 'c/d' })
    await waitForLog((d) => d.context?.feature === 'kanban_get_task', 'the sentinel failure')
    const stored = await agentLogs(mine(agentId))
    expect(stored.map((e) => `${e.severity} ${e.event_type} ${e.context.feature}`)).toEqual([
      'ERROR feature_error kanban_get_task',
    ])
    expect(JSON.stringify(stored)).not.toContain('no-such-task')
  })
})

describe('L1-6 logFailure (in-process)', () => {
  it('keeps the caller request id and task id, caps the message and context values', async () => {
    await clearLogs()
    const { logFailure } = await import('../../packages/agent/src/app-log.ts')
    const lines = vi.spyOn(console, 'error')
    try {
      await logFailure({
        severity: 'WARNING',
        event_type: 'api_call_failed',
        message: 'x'.repeat(2500),
        context: {
          target: 'firestore',
          status: 'unavailable',
          task_id: 't-6',
          big: 'y'.repeat(1500),
        },
        request_id: 'req-6',
      })
      expect(lines).toHaveBeenCalled()
    } finally {
      lines.mockRestore()
    }
    const [e] = await agentLogs((d) => d.request_id === 'req-6')
    expect(e).toEqual(
      expect.objectContaining({
        severity: 'WARNING',
        event_type: 'api_call_failed',
        source: 'server',
        message: 'x'.repeat(2000),
        context: expect.objectContaining({
          target: 'firestore',
          status: 'unavailable',
          task_id: 't-6',
          big: 'y'.repeat(1000),
        }),
      })
    )
  })
})
