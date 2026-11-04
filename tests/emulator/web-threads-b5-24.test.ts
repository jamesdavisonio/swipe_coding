// web-threads criterion 24 (B5's createTask with no live session), in the Firestore emulator
// (`npm run test:rules`): the stored task is queued whether or not any session is live; the next
// session announces it (existing agent behaviour, not tested here).
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { isQueued, taskPhase } from '../../packages/shared/src/index.ts'
import * as data from '../../packages/web/src/data.ts'
import { readTask, useEmulator } from '../fixtures/web-threads-b4-emulator.ts'
import { seedProject } from '../fixtures/web-threads-b5-emulator.ts'

vi.mock('../../packages/web/src/firebase.ts', async () =>
  (await import('../fixtures/web-threads-b4-emulator.ts')).firebaseModule()
)
vi.mock('../../packages/web/src/lib/log.ts', async () =>
  (await import('../fixtures/web-threads-b4-emulator.ts')).logModule()
)

describe('B5-24 createTask with no live session in the emulator', () => {
  useEmulator()
  // The project exists, as it does once any session has run there (createTask touches it).
  beforeEach(async () => {
    await seedProject('p1')
  })

  it('stores the task queued in a project no agent has ever reported for', async () => {
    const id = await data.createTask('p1', {
      type: 'feature',
      title: 'Plan the week view',
      description: '',
      afterDeploy: [],
    })
    const stored = await readTask(id)
    expect(stored.projectId).toBe('p1')
    expect(stored.agentId).toBeNull()
    expect(stored.stage).toBe('spec')
    expect(stored.createdBy).toBe('james')
    expect(isQueued(stored)).toBe(true)
    expect(taskPhase(stored)).toBe('queued')
  })
})
