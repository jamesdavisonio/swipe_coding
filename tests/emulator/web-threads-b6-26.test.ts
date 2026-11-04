// web-threads B6, criterion 26's write (reopenTask), in the Firestore emulator (`npm run
// test:rules`), read back as James through the real rules. Reopening a done task clears doneAt,
// sets reopenedAt now, moves the stage to the one before done in the task's own chain (re-arming
// the after-deploy need when that stage is after_deploy, else no need), records "Reopened: <note>"
// by James and sends his message kind reopen "Reopened: <note>"; afterDone is left as it was. The
// note is trimmed, required and capped at 4000. A transaction guarded on stage done: anything
// else (a double tap, a stale screen) writes nothing and resolves. History past LOG_CAP moves to
// tasks/{id}/log_archive in the same write.
import { describe, expect, it, vi } from 'vitest'
import type { Task } from '../../packages/shared/src/index.ts'
import * as data from '../../packages/web/src/data.ts'
import {
  FULL_LOG,
  LOG_CAP,
  expectUntouched,
  lastEntry,
  readArchive,
  readComments,
  readTask,
  seedTask,
  stored,
  useEmulator,
} from '../fixtures/web-threads-b4-emulator.ts'
import { doneTask } from '../fixtures/web-threads-b6-emulator.ts'

vi.mock('../../packages/web/src/firebase.ts', async () =>
  (await import('../fixtures/web-threads-b4-emulator.ts')).firebaseModule()
)
vi.mock('../../packages/web/src/lib/log.ts', async () =>
  (await import('../fixtures/web-threads-b4-emulator.ts')).logModule()
)

const NOTE = 'The nav is broken on phones'
const STEPS = ['Open the site on your phone', 'Check the logs are quiet']

// Everything on the task except what reopening sets (and the write's bookkeeping stamps).
function untouchedPart(task: Omit<Task, 'id'>) {
  const {
    doneAt: _doneAt,
    reopenedAt: _reopenedAt,
    stage: _stage,
    needs: _needs,
    log: _log,
    updatedAt: _updatedAt,
    lastCommentAt: _lastCommentAt,
    ...rest
  } = task
  return rest
}

describe('B6-26 reopenTask in the emulator', () => {
  useEmulator()

  it('reopens a done feature: doneAt cleared, reopenedAt now, back to Main CI, no need', async () => {
    const task = await seedTask(doneTask())
    const before = Date.now()
    await data.reopenTask(task, `  ${NOTE}  `)
    const after = Date.now()
    const saved = await readTask('t1')
    expect(saved.doneAt).toBeNull()
    expect(saved.reopenedAt).toBeGreaterThanOrEqual(before)
    expect(saved.reopenedAt).toBeLessThanOrEqual(after)
    expect(saved.stage).toBe('main_ci')
    expect(saved.needs).toBeNull()
    expect(untouchedPart(saved)).toEqual(untouchedPart(stored(task)))
  })

  it('records "Reopened: <note>" by James after the earlier history', async () => {
    const task = await seedTask(doneTask())
    const before = Date.now()
    await data.reopenTask(task, `  ${NOTE}  `)
    const saved = await readTask('t1')
    expect(saved.log.map((e) => e.text)).toEqual(['Done', `Reopened: ${NOTE}`])
    expect(lastEntry(saved)).toEqual(
      expect.objectContaining({ who: 'james', text: `Reopened: ${NOTE}` })
    )
    expect(lastEntry(saved)?.at).toBeGreaterThanOrEqual(before)
  })

  it('sends James\'s message kind reopen "Reopened: <note>"', async () => {
    const task = await seedTask(doneTask())
    await data.reopenTask(task, `  ${NOTE}  `)
    const comments = await readComments('t1')
    expect(comments).toHaveLength(1)
    expect(comments[0]).toEqual(
      expect.objectContaining({
        taskId: 't1',
        projectId: 'p1',
        agentId: 'agent-1',
        author: 'james',
        kind: 'reopen',
        body: `Reopened: ${NOTE}`,
        deliveredAt: null,
      })
    )
  })

  it('goes back to after_deploy and re-arms its need, leaving the ticks as they were', async () => {
    const task = await seedTask(doneTask({ afterDeploy: STEPS, afterDone: [true, true] }))
    await data.reopenTask(task, NOTE)
    const saved = await readTask('t1')
    expect(saved.stage).toBe('after_deploy')
    expect(saved.needs).toEqual({ kind: 'after_deploy' })
    expect(saved.afterDone).toEqual([true, true])
    expect(saved.doneAt).toBeNull()
  })

  it.each([
    ['bugfix', 'main_ci'],
    ['chore', 'do'],
  ] as const)('moves a %s back to %s, the stage before done in its chain', async (type, stage) => {
    const task = await seedTask(doneTask({ type }))
    await data.reopenTask(task, NOTE)
    const saved = await readTask('t1')
    expect(saved.stage).toBe(stage)
    expect(saved.needs).toBeNull()
  })

  it('writes nothing and resolves when the task is not done', async () => {
    const task = await seedTask(doneTask({ stage: 'main_ci', doneAt: null }))
    await expect(data.reopenTask(task, NOTE)).resolves.toBeUndefined()
    await expectUntouched(task)
  })

  it('writes nothing from a stale screen (the task was already reopened)', async () => {
    const onScreen = doneTask()
    const current = await seedTask(doneTask({ stage: 'main_ci', doneAt: null }))
    await expect(data.reopenTask(onScreen, NOTE)).resolves.toBeUndefined()
    await expectUntouched(current)
  })

  it('a double tap writes once', async () => {
    const task = await seedTask(doneTask())
    await data.reopenTask(task, NOTE)
    await data.reopenTask(task, NOTE)
    expect(await readComments('t1')).toHaveLength(1)
    expect((await readTask('t1')).log).toHaveLength(2)
  })

  it('writes nothing for an empty or whitespace-only note', async () => {
    const task = await seedTask(doneTask())
    await data.reopenTask(task, '').catch(() => undefined)
    await data.reopenTask(task, '   \n ').catch(() => undefined)
    await expectUntouched(task)
  })

  it('caps the note at 4000 characters', async () => {
    const task = await seedTask(doneTask())
    await data.reopenTask(task, 'x'.repeat(5000))
    const [comment] = await readComments('t1')
    expect(comment.body.startsWith('Reopened: xxx')).toBe(true)
    expect(comment.body.length).toBeGreaterThanOrEqual(4000)
    expect(comment.body.length).toBeLessThanOrEqual('Reopened: '.length + 4000)
    const text = lastEntry(await readTask('t1'))?.text ?? ''
    expect(text.startsWith('Reopened: xxx')).toBe(true)
    expect(text.length).toBeLessThanOrEqual('Reopened: '.length + 4000)
  })

  it('moves the oldest history past LOG_CAP to log_archive in the same write', async () => {
    const task = await seedTask(doneTask({ log: FULL_LOG() }))
    await data.reopenTask(task, NOTE)
    const saved = await readTask('t1')
    expect(saved.log).toHaveLength(LOG_CAP)
    expect(saved.log[0].text).toBe('Entry 1')
    expect(lastEntry(saved)?.text).toBe(`Reopened: ${NOTE}`)
    expect((await readArchive('t1')).map((e) => e.text)).toEqual(['Entry 0'])
  })
})
