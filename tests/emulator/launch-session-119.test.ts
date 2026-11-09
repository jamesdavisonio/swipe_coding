// launch-session 119, the data layer in the Firestore emulator (`npm run test:rules`): createTask
// with launch: true writes the same queued task as without it (title, type, description,
// createdBy james, first stage, the "Queued: <title>" history line, the project touched) plus
// launch { state: 'requested', requestedAt: <ms> }; without launch: true there is no launch field.
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { describe, expect, it, vi } from 'vitest'
import * as data from '../../packages/web/src/data.ts'
import { initialTaskFields } from '../../packages/shared/src/index.ts'
import { T0, jamesDb, readTask, useEmulator } from '../fixtures/web-threads-b4-emulator.ts'

vi.mock('../../packages/web/src/firebase.ts', async () =>
  (await import('../fixtures/web-threads-b4-emulator.ts')).firebaseModule()
)
vi.mock('../../packages/web/src/lib/log.ts', async () =>
  (await import('../fixtures/web-threads-b4-emulator.ts')).logModule()
)

const input = {
  type: 'bugfix' as const,
  title: 'Fix the export',
  description: 'It skips rows.',
  afterDeploy: [] as string[],
}
const seedProject = () =>
  setDoc(doc(jamesDb(), 'projects', 'p1'), {
    hostname: 'pc',
    cwd: '/work/p1',
    name: 'p1',
    createdAt: T0,
    updatedAt: T0,
  })

describe('launch-session 119 createTask in the emulator', () => {
  useEmulator()

  it('with launch: true stores the queued task plus launch { state: requested, requestedAt }', async () => {
    await seedProject()
    const before = Date.now()
    const id = await (data.createTask as (p: string, i: unknown) => Promise<string>)('p1', {
      ...input,
      launch: true,
    })
    const task = await readTask(id)
    expect(task.launch).toEqual({ state: 'requested', requestedAt: expect.any(Number) })
    expect(task.launch?.requestedAt).toBeGreaterThanOrEqual(before)
    expect(task.launch?.requestedAt).toBeLessThanOrEqual(Date.now())
    expect(task).toMatchObject({
      projectId: 'p1',
      type: 'bugfix',
      title: 'Fix the export',
      description: 'It skips rows.',
      createdBy: 'james',
      stage: initialTaskFields({ ...input, projectId: 'p1', createdBy: 'james', now: 0 }).stage,
      needs: null,
    })
    expect(task.log).toEqual([{ at: task.createdAt, who: 'james', text: 'Queued: Fix the export' }])
    const project = await getDoc(doc(jamesDb(), 'projects', 'p1'))
    expect(project.get('updatedAt')).toBe(task.createdAt)
  })

  it('is otherwise the same task as one made without launch, which has no launch field', async () => {
    await seedProject()
    const plain = await readTask(await data.createTask('p1', input))
    const launched = await readTask(
      await (data.createTask as (p: string, i: unknown) => Promise<string>)('p1', {
        ...input,
        launch: true,
      })
    )
    expect('launch' in plain).toBe(false)
    expect(Object.keys(launched).sort()).toEqual([...Object.keys(plain), 'launch'].sort())
    expect({ ...launched, launch: undefined, createdAt: 0, updatedAt: 0, log: [] }).toEqual({
      ...plain,
      launch: undefined,
      createdAt: 0,
      updatedAt: 0,
      log: [],
    })
  })

  it('launch: false writes no launch field', async () => {
    await seedProject()
    const task = await readTask(
      await (data.createTask as (p: string, i: unknown) => Promise<string>)('p1', {
        ...input,
        launch: false,
      })
    )
    expect('launch' in task).toBe(false)
  })
})
