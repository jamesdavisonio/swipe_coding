// web-threads criterion 23's write (B5's createTask), in the Firestore emulator (`npm run
// test:rules`): James's new task is stored in the shared initial shape (first stage of its chain,
// bound to no agent, so queued), with the title and description trimmed and capped, the
// after-deploy steps and their unticked marks, and one history entry by James
// "Queued: <title>[ · N after-deploy step(s)]". No message is stored (the queue line is the
// thread view's). It returns the new id; a blank title writes nothing and rejects.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { initialTaskFields, isQueued, type TaskType } from '../../packages/shared/src/index.ts'
import * as data from '../../packages/web/src/data.ts'
import { T0, readComments, readTask, useEmulator } from '../fixtures/web-threads-b4-emulator.ts'
import { readTasks, seedProject } from '../fixtures/web-threads-b5-emulator.ts'

vi.mock('../../packages/web/src/firebase.ts', async () =>
  (await import('../fixtures/web-threads-b4-emulator.ts')).firebaseModule()
)
vi.mock('../../packages/web/src/lib/log.ts', async () =>
  (await import('../fixtures/web-threads-b4-emulator.ts')).logModule()
)

interface Input {
  type: TaskType
  title: string
  description: string
  afterDeploy: string[]
}
const input = (over: Partial<Input> = {}): Input => ({
  type: 'feature',
  title: 'Add search',
  description: '',
  afterDeploy: [],
  ...over,
})

// The whole stored document the contract describes, from the shared initial shape.
async function expectStored(
  id: string,
  want: { type: TaskType; title: string; description: string; afterDeploy: string[]; log: string }
) {
  const stored = await readTask(id)
  expect(stored).toEqual({
    ...initialTaskFields({
      projectId: 'p1',
      type: want.type,
      title: want.title,
      description: want.description,
      createdBy: 'james',
      afterDeploy: want.afterDeploy,
      now: stored.createdAt,
    }),
    log: [{ at: expect.any(Number) as number, who: 'james', text: want.log }],
  })
  expect(stored.createdAt).toBeGreaterThan(T0)
  return stored
}

describe('B5-23 createTask in the emulator', () => {
  useEmulator()
  // The project exists, as it does once any session has run there (createTask touches it).
  beforeEach(async () => {
    await seedProject('p1')
  })

  it('stores a queued feature with its history entry and returns the new id', async () => {
    const id = await data.createTask(
      'p1',
      input({ title: '  Add search  ', description: '  Find any task by its title  ' })
    )
    expect((await readTasks()).map((t) => t.id)).toEqual([id])
    const stored = await expectStored(id, {
      type: 'feature',
      title: 'Add search',
      description: 'Find any task by its title',
      afterDeploy: [],
      log: 'Queued: Add search',
    })
    expect(stored.stage).toBe('spec')
    expect(stored.agentId).toBeNull()
    expect(isQueued(stored)).toBe(true)
    // The queue line is shown by the thread view, never stored as a message.
    expect(await readComments(id)).toEqual([])
  })

  it('stores the after-deploy steps, unticked, and counts them in the history', async () => {
    const id = await data.createTask(
      'p1',
      input({ title: 'Ship the footer', afterDeploy: ['Open the site', 'Check the logs'] })
    )
    const stored = await expectStored(id, {
      type: 'feature',
      title: 'Ship the footer',
      description: '',
      afterDeploy: ['Open the site', 'Check the logs'],
      log: 'Queued: Ship the footer · 2 after-deploy steps',
    })
    expect(stored.afterDone).toEqual([false, false])
  })

  it('says "1 after-deploy step" for one', async () => {
    const id = await data.createTask('p1', input({ title: 'Tidy up', afterDeploy: ['Clear it'] }))
    await expectStored(id, {
      type: 'feature',
      title: 'Tidy up',
      description: '',
      afterDeploy: ['Clear it'],
      log: 'Queued: Tidy up · 1 after-deploy step',
    })
  })

  it.each([
    ['bugfix', 'fix'],
    ['chore', 'do'],
  ] as const)('starts a %s at the first stage of its chain (%s)', async (type, stage) => {
    const id = await data.createTask('p1', input({ type, title: 'Fix the header' }))
    const stored = await expectStored(id, {
      type,
      title: 'Fix the header',
      description: '',
      afterDeploy: [],
      log: 'Queued: Fix the header',
    })
    expect(stored.stage).toBe(stage)
    expect(isQueued(stored)).toBe(true)
  })

  it('caps the title at 200, the description at 4000, each step at 300 and the steps at 20', async () => {
    const steps = ['s'.repeat(400), ...Array.from({ length: 24 }, (_, i) => `Step ${i + 1}`)]
    const id = await data.createTask(
      'p1',
      input({ title: 't'.repeat(250), description: 'd'.repeat(5000), afterDeploy: steps })
    )
    const kept = ['s'.repeat(300), ...steps.slice(1, 20)]
    const stored = await expectStored(id, {
      type: 'feature',
      title: 't'.repeat(200),
      description: 'd'.repeat(4000),
      afterDeploy: kept,
      log: `Queued: ${'t'.repeat(200)} · 20 after-deploy steps`,
    })
    expect(stored.afterDone).toHaveLength(20)
  })

  it('a blank title writes nothing and rejects', async () => {
    let rejected = false
    await data.createTask('p1', input({ title: '   ' })).catch(() => {
      rejected = true
    })
    expect(rejected).toBe(true)
    expect(await readTasks()).toEqual([])
  })
})
