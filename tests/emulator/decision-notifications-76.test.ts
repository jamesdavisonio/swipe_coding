// decision-notifications 76 (and 75's record removal), in the Firestore emulator (`npm run test:rules`):
// the real data.ts writes devices/{deviceId} as James under the real rules. A changed token
// replaces the stored one in the same record (createdAt kept), so a browser keeps exactly one
// record; removeDevice deletes it.
import { collection, doc, getDoc, getDocs, setDoc } from 'firebase/firestore'
import { describe, expect, it, vi } from 'vitest'
import { removeDevice, saveDevice } from '../../packages/web/src/data.ts'
import { jamesDb, useEmulator } from '../fixtures/web-threads-b4-emulator.ts'

vi.mock('../../packages/web/src/firebase.ts', async () =>
  (await import('../fixtures/web-threads-b4-emulator.ts')).firebaseModule()
)
vi.mock('../../packages/web/src/lib/log.ts', async () =>
  (await import('../fixtures/web-threads-b4-emulator.ts')).logModule()
)

const records = async () =>
  (await getDocs(collection(jamesDb(), 'devices'))).docs.map((d) => ({ id: d.id, ...d.data() }))

describe('decision-notifications 76 device record in the emulator', () => {
  useEmulator()

  it('stores token, createdAt and updatedAt, and nothing else', async () => {
    const before = Date.now()
    await saveDevice('dev-1', 'token-a')
    const after = Date.now()
    const stored = (await getDoc(doc(jamesDb(), 'devices', 'dev-1'))).data()
    expect(Object.keys(stored ?? {}).sort()).toEqual(['createdAt', 'token', 'updatedAt'])
    expect(stored?.token).toBe('token-a')
    expect(stored?.createdAt).toBeGreaterThanOrEqual(before)
    expect(stored?.createdAt).toBeLessThanOrEqual(after)
    expect(stored?.updatedAt).toBeGreaterThanOrEqual(before)
  })

  it('a changed token replaces the stored one: still one record, createdAt kept', async () => {
    await setDoc(doc(jamesDb(), 'devices', 'dev-1'), {
      token: 'token-a',
      createdAt: 1,
      updatedAt: 1,
    })
    const first = (await getDoc(doc(jamesDb(), 'devices', 'dev-1'))).data()
    await saveDevice('dev-1', 'token-b')
    const list = await records()
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({ id: 'dev-1', token: 'token-b', createdAt: 1 })
    expect(list[0]).toHaveProperty('updatedAt')
    expect((list[0] as unknown as { updatedAt: number }).updatedAt).toBeGreaterThanOrEqual(
      first?.updatedAt as number
    )
  })

  it('the same token saved again changes nothing but updatedAt, still one record', async () => {
    await saveDevice('dev-1', 'token-a')
    await saveDevice('dev-1', 'token-a')
    const list = await records()
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({ token: 'token-a' })
  })

  it('another browser gets its own record', async () => {
    await saveDevice('dev-1', 'token-a')
    await saveDevice('dev-2', 'token-b')
    expect((await records()).map((r) => r.id).sort()).toEqual(['dev-1', 'dev-2'])
  })

  it('removeDevice deletes only that browser record', async () => {
    await saveDevice('dev-1', 'token-a')
    await saveDevice('dev-2', 'token-b')
    await removeDevice('dev-1')
    expect((await records()).map((r) => r.id)).toEqual(['dev-2'])
  })
})
