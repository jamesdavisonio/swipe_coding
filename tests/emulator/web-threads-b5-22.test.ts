// web-threads criterion 22's writes on a project's For James tab (addTodo, toggleTodo), in the
// Firestore emulator (`npm run test:rules`): adding stores an open todo with the text trimmed and
// capped at 500, refusing blank text; ticking marks a todo done with doneAt, unticking reopens it.
// The rules accept both as James.
import { describe, expect, it, vi } from 'vitest'
import * as data from '../../packages/web/src/data.ts'
import { T0, useEmulator } from '../fixtures/web-threads-b4-emulator.ts'
import { makeTodo, readTodos, seedTodo } from '../fixtures/web-threads-b5-emulator.ts'

vi.mock('../../packages/web/src/firebase.ts', async () =>
  (await import('../fixtures/web-threads-b4-emulator.ts')).firebaseModule()
)
vi.mock('../../packages/web/src/lib/log.ts', async () =>
  (await import('../fixtures/web-threads-b4-emulator.ts')).logModule()
)

describe('B5-22 addTodo in the emulator', () => {
  useEmulator()

  it('stores an open todo for the project, text trimmed, no link', async () => {
    await data.addTodo('p1', '  Rotate the key  ')
    const todos = await readTodos()
    expect(todos).toHaveLength(1)
    expect(todos[0]).toEqual(
      expect.objectContaining({
        projectId: 'p1',
        body: 'Rotate the key',
        link: null,
        done: false,
        sourceTaskId: null,
        doneAt: null,
      })
    )
    expect(todos[0].createdAt).toBeGreaterThan(T0)
  })

  it('caps the text at 500 characters', async () => {
    await data.addTodo('p1', 'x'.repeat(600))
    const [todo] = await readTodos()
    expect(todo.body).toBe('x'.repeat(500))
  })

  it.each(['', '   ', '\n\t '])('refuses blank text %j and writes nothing', async (text) => {
    await data.addTodo('p1', text).catch(() => undefined)
    expect(await readTodos()).toEqual([])
  })
})

describe('B5-22 toggleTodo in the emulator', () => {
  useEmulator()

  it('ticking an open todo marks it done with doneAt, nothing else changes', async () => {
    const todo = await seedTodo(makeTodo('td1', { body: 'Rotate the key' }))
    await data.toggleTodo(todo)
    const [stored] = await readTodos()
    expect(stored).toEqual({ ...todo, done: true, doneAt: expect.any(Number) as number })
    expect(stored.doneAt).toBeGreaterThan(T0)
  })

  it('unticking a done todo reopens it and clears doneAt', async () => {
    const todo = await seedTodo(makeTodo('td1', { done: true, doneAt: T0 + 1 }))
    await data.toggleTodo(todo)
    const [stored] = await readTodos()
    expect(stored).toEqual({ ...todo, done: false, doneAt: null })
  })
})
