// decision-notifications 87, behaviourally in the Firestore emulator (`npm run test:rules`): the
// signed-in owner (either address, verified) can create, read, update and delete devices/{id}; a
// record holds exactly token, createdAt and updatedAt (token a string of 1 to 4096 characters,
// both times numbers) and anything else is refused; everyone else is refused.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import {
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  collection,
  setDoc,
  updateDoc,
  type Firestore,
} from 'firebase/firestore'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'

let env: RulesTestEnvironment
beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-kanban',
    firestore: {
      rules: readFileSync(join(import.meta.dirname, '..', '..', 'firestore.rules'), 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  })
})
afterAll(() => env.cleanup())
beforeEach(() => env.clearFirestore())

const ctx = (uid: string, email: string, verified: boolean) =>
  env
    .authenticatedContext(uid, { email, email_verified: verified })
    .firestore() as unknown as Firestore
const james = () => ctx('james-uid', 'j@nullnoise.ai', true)
const jamesAlt = () => ctx('james-uid-2', 'james@nullnoise.ai', true)
const others: [string, () => Firestore][] = [
  ['stranger', () => ctx('someone', 'someone@example.com', true)],
  ['unverified James', () => ctx('james-unverified', 'j@nullnoise.ai', false)],
  ['anonymous', () => env.unauthenticatedContext().firestore() as unknown as Firestore],
]

const device = (over: Record<string, unknown> = {}) => ({
  token: 'fcm-token-1',
  createdAt: 1_800_000_000_000,
  updatedAt: 1_800_000_000_000,
  ...over,
})
const seed = (id = 'dev1', data: Record<string, unknown> = device()) =>
  env.withSecurityRulesDisabled(async (c) => {
    await setDoc(doc(c.firestore() as unknown as Firestore, 'devices', id), data)
  })

describe('decision-notifications 87: the owner', () => {
  it('creates, reads, updates and deletes a device record (either address)', async () => {
    for (const who of [james, jamesAlt]) {
      const db = who()
      await assertSucceeds(setDoc(doc(db, 'devices', 'dev1'), device()))
      await assertSucceeds(getDoc(doc(db, 'devices', 'dev1')))
      await assertSucceeds(getDocs(collection(db, 'devices')))
      await assertSucceeds(
        setDoc(
          doc(db, 'devices', 'dev1'),
          device({ token: 'fcm-token-2', updatedAt: 1_800_000_000_500 })
        )
      )
      await assertSucceeds(
        updateDoc(doc(db, 'devices', 'dev1'), { token: 'fcm-token-3', updatedAt: 2 })
      )
      await assertSucceeds(deleteDoc(doc(db, 'devices', 'dev1')))
    }
  })

  it('accepts a token of 1 and of 4096 characters', async () => {
    await assertSucceeds(setDoc(doc(james(), 'devices', 'short'), device({ token: 't' })))
    await assertSucceeds(
      setDoc(doc(james(), 'devices', 'long'), device({ token: 't'.repeat(4096) }))
    )
  })

  const refused: [string, Record<string, unknown>][] = [
    ['an extra field', { extra: 'x' }],
    ['a token of 4097 characters', { token: 't'.repeat(4097) }],
    ['an empty token', { token: '' }],
    ['a token that is a number', { token: 42 }],
    ['a token that is null', { token: null }],
    ['a createdAt that is a string', { createdAt: '1800000000000' }],
    ['an updatedAt that is a string', { updatedAt: '1800000000000' }],
    ['an updatedAt that is null', { updatedAt: null }],
  ]
  for (const [what, over] of refused)
    it(`refuses a create with ${what}`, async () => {
      await assertFails(setDoc(doc(james(), 'devices', 'bad'), device(over)))
    })

  it.each(['token', 'createdAt', 'updatedAt'])('refuses a create without %s', async (key) => {
    const data: Record<string, unknown> = device()
    delete data[key]
    await assertFails(setDoc(doc(james(), 'devices', 'bad'), data))
  })

  for (const [what, over] of refused)
    it(`refuses an update with ${what}`, async () => {
      await seed()
      await assertFails(setDoc(doc(james(), 'devices', 'dev1'), device(over)))
      await assertFails(updateDoc(doc(james(), 'devices', 'dev1'), over))
    })
})

describe('decision-notifications 87: everyone else', () => {
  for (const [who, db] of others)
    it(`${who} cannot create, read, list, update or delete a device record`, async () => {
      await seed()
      await assertFails(setDoc(doc(db(), 'devices', 'new'), device()))
      await assertFails(getDoc(doc(db(), 'devices', 'dev1')))
      await assertFails(getDocs(collection(db(), 'devices')))
      await assertFails(updateDoc(doc(db(), 'devices', 'dev1'), { token: 'taken', updatedAt: 2 }))
      await assertFails(deleteDoc(doc(db(), 'devices', 'dev1')))
    })
})
