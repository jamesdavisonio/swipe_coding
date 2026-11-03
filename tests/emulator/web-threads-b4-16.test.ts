// web-threads B4, criterion 16, in the Firestore emulator (`npm run test:rules`): what
// approveSpec and requestChange store when James decides on a spec, read back as James through
// the real rules. Approve: stage build, need cleared, history "Approved spec v<N>", James's
// message kind approve "Approved.". Change request: need cleared, stage kept, history "Asked for
// a change to spec v<N>: <text>", message kind change_request "Change: <text>". Both are guarded
// transactions (a double tap or a stale screen writes nothing) and move history past LOG_CAP to
// tasks/{id}/log_archive.
import { describe, expect, it, vi } from 'vitest'
import * as data from '../../packages/web/src/data.ts'
import {
  FULL_LOG,
  LOG_CAP,
  T0,
  expectUntouched,
  lastEntry,
  makeTask,
  readArchive,
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

const SPEC = {
  goal: 'Find any task by its title',
  points: ['A search box'],
  out: 'Comments',
  touches: 'Threads',
  version: 3,
}
const specTask = (over: Parameters<typeof makeTask>[1] = {}) =>
  makeTask('t1', { stage: 'spec', needs: { kind: 'spec' }, spec: SPEC, ...over })

describe('B4-16 approveSpec in the emulator', () => {
  useEmulator()

  it('moves to build, clears the need, records "Approved spec v<N>" and sends "Approved."', async () => {
    const task = await seedTask(specTask())
    const before = Date.now()
    await data.approveSpec(task)
    const after = Date.now()
    const stored = await readTask('t1')
    expect(stored.stage).toBe('build')
    expect(stored.needs).toBeNull()
    expect(stored.log).toHaveLength(1)
    expect(lastEntry(stored)).toEqual(
      expect.objectContaining({ who: 'james', text: 'Approved spec v3' })
    )
    expect(lastEntry(stored)?.at).toBeGreaterThanOrEqual(before)
    expect(lastEntry(stored)?.at).toBeLessThanOrEqual(after)
    const comments = await readComments('t1')
    expect(comments).toHaveLength(1)
    expect(comments[0]).toEqual(
      expect.objectContaining({
        taskId: 't1',
        projectId: 'p1',
        agentId: 'agent-1',
        author: 'james',
        kind: 'approve',
        body: 'Approved.',
        deliveredAt: null,
      })
    )
    expect(stored.updatedAt).toBeGreaterThan(T0)
    expect(stored.lastCommentAt).toBe(comments[0].createdAt)
  })

  it('approves from stage approved too', async () => {
    const task = await seedTask(specTask({ stage: 'approved' }))
    await data.approveSpec(task)
    const stored = await readTask('t1')
    expect(stored.stage).toBe('build')
    expect(lastEntry(stored)?.text).toBe('Approved spec v3')
  })

  it('records v1 when the task has no spec', async () => {
    const task = await seedTask(specTask({ spec: null }))
    await data.approveSpec(task)
    expect(lastEntry(await readTask('t1'))?.text).toBe('Approved spec v1')
    expect((await readComments('t1'))[0].body).toBe('Approved.')
  })

  it('keeps the earlier history and appends to it', async () => {
    const earlier = [{ at: T0, who: 'session' as const, text: 'Spec v3 ready' }]
    const task = await seedTask(specTask({ log: earlier }))
    await data.approveSpec(task)
    const stored = await readTask('t1')
    expect(stored.log.map((e) => e.text)).toEqual(['Spec v3 ready', 'Approved spec v3'])
  })

  it('writes nothing when the need is not a spec', async () => {
    const task = await seedTask(specTask({ needs: { kind: 'question', question: 'Why?' } }))
    await data.approveSpec(task)
    await expectUntouched(task)
  })

  it('writes nothing outside stage spec or approved', async () => {
    const task = await seedTask(specTask({ stage: 'build' }))
    await data.approveSpec(task)
    await expectUntouched(task)
  })

  it('writes nothing from a stale screen (the need was already cleared)', async () => {
    const onScreen = specTask()
    const current = await seedTask(specTask({ needs: null }))
    await data.approveSpec(onScreen)
    await expectUntouched(current)
  })

  it('a double tap writes once', async () => {
    const task = await seedTask(specTask())
    await data.approveSpec(task)
    await data.approveSpec(task)
    expect(await readComments('t1')).toHaveLength(1)
    expect((await readTask('t1')).log).toHaveLength(1)
  })

  it('moves the oldest history past LOG_CAP to log_archive in the same write', async () => {
    const task = await seedTask(specTask({ log: FULL_LOG() }))
    await data.approveSpec(task)
    const stored = await readTask('t1')
    expect(stored.log).toHaveLength(LOG_CAP)
    expect(stored.log[0].text).toBe('Entry 1')
    expect(lastEntry(stored)?.text).toBe('Approved spec v3')
    const archive = await readArchive('t1')
    expect(archive).toHaveLength(1)
    expect(archive[0]).toEqual(expect.objectContaining({ at: T0, who: 'session', text: 'Entry 0' }))
  })
})

describe('B4-16 requestChange in the emulator', () => {
  useEmulator()

  it('clears the need, keeps the stage, records the text and sends "Change: <text>"', async () => {
    const task = await seedTask(specTask())
    await data.requestChange(task, '  Search comments too  ')
    const stored = await readTask('t1')
    expect(stored.stage).toBe('spec')
    expect(stored.needs).toBeNull()
    expect(stored.spec).toEqual(SPEC)
    expect(stored.log).toHaveLength(1)
    expect(lastEntry(stored)).toEqual(
      expect.objectContaining({
        who: 'james',
        text: 'Asked for a change to spec v3: Search comments too',
      })
    )
    const comments = await readComments('t1')
    expect(comments).toHaveLength(1)
    expect(comments[0]).toEqual(
      expect.objectContaining({
        taskId: 't1',
        author: 'james',
        kind: 'change_request',
        body: 'Change: Search comments too',
      })
    )
    expect(stored.lastCommentAt).toBe(comments[0].createdAt)
  })

  it('works from stage approved and records v1 without a spec', async () => {
    const task = await seedTask(specTask({ stage: 'approved', spec: null }))
    await data.requestChange(task, 'Start over')
    const stored = await readTask('t1')
    expect(stored.stage).toBe('approved')
    expect(lastEntry(stored)?.text).toBe('Asked for a change to spec v1: Start over')
  })

  it('writes nothing for empty or whitespace-only text', async () => {
    const task = await seedTask(specTask())
    await data.requestChange(task, '')
    await data.requestChange(task, '   \n ')
    await expectUntouched(task)
  })

  it('caps the text at 4000 characters', async () => {
    const task = await seedTask(specTask())
    await data.requestChange(task, 'x'.repeat(5000))
    const [comment] = await readComments('t1')
    expect(comment.body.startsWith('Change: xxx')).toBe(true)
    expect(comment.body.length).toBeGreaterThanOrEqual(4000)
    expect(comment.body.length).toBeLessThanOrEqual('Change: '.length + 4000)
    const text = lastEntry(await readTask('t1'))?.text ?? ''
    expect(text.startsWith('Asked for a change to spec v3: xxx')).toBe(true)
    expect(text.length).toBeLessThanOrEqual('Asked for a change to spec v3: '.length + 4000)
  })

  it('writes nothing when the need is not a spec', async () => {
    const task = await seedTask(specTask({ needs: { kind: 'pr' }, stage: 'pr' }))
    await data.requestChange(task, 'Search comments too')
    await expectUntouched(task)
  })

  it('a double tap writes once', async () => {
    const task = await seedTask(specTask())
    await data.requestChange(task, 'Search comments too')
    await data.requestChange(task, 'Search comments too')
    expect(await readComments('t1')).toHaveLength(1)
    expect((await readTask('t1')).log).toHaveLength(1)
  })

  it('moves the oldest history past LOG_CAP to log_archive in the same write', async () => {
    const task = await seedTask(specTask({ log: FULL_LOG() }))
    await data.requestChange(task, 'Search comments too')
    const stored = await readTask('t1')
    expect(stored.log).toHaveLength(LOG_CAP)
    expect(stored.log[0].text).toBe('Entry 1')
    expect(lastEntry(stored)?.text).toBe('Asked for a change to spec v3: Search comments too')
    const archive = await readArchive('t1')
    expect(archive.map((e) => e.text)).toEqual(['Entry 0'])
  })
})
