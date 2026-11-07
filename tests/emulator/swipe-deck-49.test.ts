// swipe-deck 49, data side, in the Firestore emulator (`npm run test:rules`): the writes behind
// the right swipe. tickRemainingSteps closes an after-deploy task as ticking the last step does;
// markTodosDone marks the given to-dos done; queueSuggestion queues a feature task in the project
// with the suggestion as its title.
import { describe, expect, it, vi } from 'vitest'
import * as data from '../../packages/web/src/data.ts'
import {
  expectUntouched,
  lastEntry,
  makeTask,
  readComments,
  readTask,
  seedTask,
  useEmulator,
} from '../fixtures/web-threads-b4-emulator.ts'
import { makeTodo, readTodos, seedProject, seedTodo } from '../fixtures/web-threads-b5-emulator.ts'

vi.mock('../../packages/web/src/firebase.ts', async () =>
  (await import('../fixtures/web-threads-b4-emulator.ts')).firebaseModule()
)
vi.mock('../../packages/web/src/lib/log.ts', async () =>
  (await import('../fixtures/web-threads-b4-emulator.ts')).logModule()
)

const adTask = (over: Parameters<typeof makeTask>[1] = {}) =>
  makeTask('t1', {
    stage: 'after_deploy',
    needs: { kind: 'after_deploy' },
    afterDeploy: ['A', 'B', 'C'],
    afterDone: [true, false, false],
    ...over,
  })

describe('swipe-deck 49: tickRemainingSteps in the emulator', () => {
  useEmulator()

  it('ticks every remaining step and closes the task like the last tick does', async () => {
    const task = await seedTask(adTask())
    const before = Date.now()
    await data.tickRemainingSteps(task)
    const stored = await readTask('t1')
    expect(stored.afterDone).toEqual([true, true, true])
    expect(stored.stage).toBe('done')
    expect(stored.doneAt).toBeGreaterThanOrEqual(before)
    expect(stored.needs).toBeNull()
    expect(stored.working).toBe(false)
    const texts = stored.log.map((e) => e.text)
    expect(texts).toContain('Step done: B')
    expect(texts).toContain('Step done: C')
    expect(texts).not.toContain('Step done: A')
    expect(lastEntry(stored)).toEqual(expect.objectContaining({ who: 'system', text: 'Done' }))
    const comments = await readComments('t1')
    expect(comments).toHaveLength(1)
    expect(comments[0]).toEqual(
      expect.objectContaining({
        author: 'james',
        kind: 'comment',
        body: 'After-deploy steps done.',
      })
    )
  })

  it('a second call with the same stale task writes nothing more', async () => {
    const task = await seedTask(adTask())
    await data.tickRemainingSteps(task)
    const once = await readTask('t1')
    await data.tickRemainingSteps(task)
    expect(await readComments('t1')).toHaveLength(1)
    expect((await readTask('t1')).log).toEqual(once.log)
  })

  it('writes nothing outside stage after_deploy', async () => {
    const task = await seedTask(adTask({ stage: 'main_ci', needs: null }))
    await data.tickRemainingSteps(task)
    await expectUntouched(task)
  })
})

describe('swipe-deck 49: markTodosDone in the emulator', () => {
  useEmulator()

  it('marks every given to-do done with a time and leaves the others open', async () => {
    const todos = [
      await seedTodo(makeTodo('a')),
      await seedTodo(makeTodo('b')),
      await seedTodo(makeTodo('other')),
    ]
    const before = Date.now()
    await data.markTodosDone(todos.slice(0, 2))
    const stored = Object.fromEntries((await readTodos()).map((t) => [t.id, t]))
    for (const id of ['a', 'b']) {
      expect(stored[id].done).toBe(true)
      expect(stored[id].doneAt).toBeGreaterThanOrEqual(before)
    }
    expect(stored.other.done).toBe(false)
    expect(stored.other.doneAt).toBeNull()
  })

  it('does nothing for an empty list', async () => {
    await seedTodo(makeTodo('a'))
    await data.markTodosDone([])
    expect((await readTodos())[0].done).toBe(false)
  })
})

describe('swipe-deck 49: queueSuggestion in the emulator', () => {
  useEmulator()

  it('queues a feature task in the project titled with the suggestion', async () => {
    await seedProject('p1')
    const id = await data.queueSuggestion('p1', 'Add dark mode')
    const stored = await readTask(id)
    expect(stored).toEqual(
      expect.objectContaining({
        projectId: 'p1',
        type: 'feature',
        title: 'Add dark mode',
        description: '',
        agentId: null,
        afterDeploy: [],
      })
    )
    expect(lastEntry(stored)).toEqual(
      expect.objectContaining({ who: 'james', text: 'Queued: Add dark mode' })
    )
  })

  it('uses the note as the description', async () => {
    await seedProject('p1')
    const id = await data.queueSuggestion('p1', 'Add search', 'Make it fast')
    expect((await readTask(id)).description).toBe('Make it fast')
  })
})
