// web-threads criterion 11's write (B2's markRead), in the Firestore emulator (`npm run
// test:rules`): opening an unread thread clears its unread flag, accepted by the rules as James,
// and leaves updatedAt (the row's place in the list) and everything else as it was.
import { describe, expect, it, vi } from 'vitest'
import * as data from '../../packages/web/src/data.ts'
import {
  makeTask,
  readComments,
  readTask,
  seedTask,
  stored,
  useEmulator,
} from '../fixtures/web-threads-b4-emulator.ts'

vi.mock('../../packages/web/src/firebase.ts', async () =>
  (await import('../fixtures/web-threads-b4-emulator.ts')).firebaseModule()
)
vi.mock('../../packages/web/src/lib/log.ts', async () =>
  (await import('../fixtures/web-threads-b4-emulator.ts')).logModule()
)

describe('B2-11 markRead in the emulator', () => {
  useEmulator()

  it('clears unread and changes nothing else', async () => {
    const task = await seedTask(makeTask('t1', { stage: 'build', unread: true }))
    await data.markRead(task)
    expect(await readTask('t1')).toEqual({ ...stored(task), unread: false })
    expect(await readComments('t1')).toEqual([])
  })

  it('is harmless on a thread that is already read', async () => {
    const task = await seedTask(makeTask('t1', { stage: 'build', unread: false }))
    await data.markRead(task)
    expect(await readTask('t1')).toEqual(stored(task))
  })
})
