// web-threads B4, criterion 19, in the Firestore emulator (`npm run test:rules`): what tickStep
// stores when James ticks an after-deploy step, read back as James through the real rules. A
// tick flips afterDone[index] and records "Step done: <step>" (unticking: "Step unticked:
// <step>"); the tick that completes every step also moves the task to done with doneAt now,
// clears the need and working, records "Done" (system) and sends "After-deploy steps done.".
// Only at stage after_deploy and for a real step; otherwise nothing is written.
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

vi.mock('../../packages/web/src/firebase.ts', async () =>
  (await import('../fixtures/web-threads-b4-emulator.ts')).firebaseModule()
)
vi.mock('../../packages/web/src/lib/log.ts', async () =>
  (await import('../fixtures/web-threads-b4-emulator.ts')).logModule()
)

const STEPS = ['Open the site on your phone', 'Check the logs are quiet']
const afterDeployTask = (over: Parameters<typeof makeTask>[1] = {}) =>
  makeTask('t1', {
    stage: 'after_deploy',
    needs: { kind: 'after_deploy' },
    afterDeploy: STEPS,
    afterDone: [false, false],
    working: true,
    ...over,
  })

describe('B4-19 tickStep in the emulator', () => {
  useEmulator()

  it('ticks a step and records "Step done: <step>", leaving the task open', async () => {
    const task = await seedTask(afterDeployTask())
    await data.tickStep(task, 1)
    const stored = await readTask('t1')
    expect(stored.afterDone).toEqual([false, true])
    expect(stored.stage).toBe('after_deploy')
    expect(stored.needs).toEqual({ kind: 'after_deploy' })
    expect(stored.doneAt).toBeNull()
    expect(stored.log).toHaveLength(1)
    expect(lastEntry(stored)).toEqual(
      expect.objectContaining({ who: 'james', text: `Step done: ${STEPS[1]}` })
    )
    expect(await readComments('t1')).toEqual([])
  })

  it('unticks a step and records "Step unticked: <step>"', async () => {
    const task = await seedTask(afterDeployTask({ afterDone: [true, false] }))
    await data.tickStep(task, 0)
    const stored = await readTask('t1')
    expect(stored.afterDone).toEqual([false, false])
    expect(stored.stage).toBe('after_deploy')
    expect(lastEntry(stored)?.text).toBe(`Step unticked: ${STEPS[0]}`)
    expect(await readComments('t1')).toEqual([])
  })

  it('the last tick moves the task to done, records Done and sends the closing message', async () => {
    const task = await seedTask(afterDeployTask({ afterDone: [true, false] }))
    const before = Date.now()
    await data.tickStep(task, 1)
    const after = Date.now()
    const stored = await readTask('t1')
    expect(stored.afterDone).toEqual([true, true])
    expect(stored.stage).toBe('done')
    expect(stored.doneAt).toBeGreaterThanOrEqual(before)
    expect(stored.doneAt).toBeLessThanOrEqual(after)
    expect(stored.needs).toBeNull()
    expect(stored.working).toBe(false)
    expect(stored.log.map((e) => [e.who, e.text])).toEqual([
      ['james', `Step done: ${STEPS[1]}`],
      ['system', 'Done'],
    ])
    const comments = await readComments('t1')
    expect(comments).toHaveLength(1)
    expect(comments[0]).toEqual(
      expect.objectContaining({
        taskId: 't1',
        projectId: 'p1',
        agentId: 'agent-1',
        author: 'james',
        kind: 'comment',
        body: 'After-deploy steps done.',
      })
    )
  })

  it('a single-step task is done on its one tick', async () => {
    const task = await seedTask(afterDeployTask({ afterDeploy: [STEPS[0]], afterDone: [false] }))
    await data.tickStep(task, 0)
    const stored = await readTask('t1')
    expect(stored.stage).toBe('done')
    expect(stored.log.map((e) => e.text)).toEqual([`Step done: ${STEPS[0]}`, 'Done'])
  })

  it('writes nothing outside stage after_deploy', async () => {
    const task = await seedTask(afterDeployTask({ stage: 'main_ci', needs: null }))
    await data.tickStep(task, 0)
    await expectUntouched(task)
  })

  it.each([-1, 2, 1.5])('writes nothing for index %s, which is not a step', async (index) => {
    const task = await seedTask(afterDeployTask())
    await data.tickStep(task, index)
    await expectUntouched(task)
  })
})
