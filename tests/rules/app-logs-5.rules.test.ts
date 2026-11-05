// app-logs L1, criterion 5, behaviourally in the Firestore emulator (`npm run test:rules`): no
// browser can read, change or delete a stored log event, and James's browser can only create one
// in the exact event shape (the 18 fields, allowed severity/env/audience, source web_client,
// bounded strings, a context of at most 30 keys, expireAt within 31 days). Anyone else is
// refused outright. The refusals also hold today (default deny); the accepted creates are new.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  type Firestore,
} from 'firebase/firestore'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'

const DAY = 24 * 60 * 60 * 1000

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

// A stored event exactly as the web log store writes it.
const event = (over: Record<string, unknown> = {}) => {
  const ts = Date.now()
  return {
    schema_version: 1,
    taxonomy_version: 6,
    timestamp: new Date(ts).toISOString(),
    severity: 'WARNING',
    app_id: 'kanban',
    client_id: 'jamesdavisonio',
    env: 'prod',
    source: 'web_client',
    event_type: 'api_call_failed',
    audience: 'internal',
    session_id: '6f1c2a40-0d7e-4c55-9f0e-1b2c3d4e5f60',
    trace_id: null,
    user_id: null,
    message: 'Saving the reply failed',
    context: { target: 'firestore', status: 'unavailable', request_id: 'r-5' },
    ts,
    expireAt: Timestamp.fromMillis(ts + 30 * DAY),
    request_id: 'r-5',
    ...over,
  }
}
const create = (db: Firestore, data: Record<string, unknown>) =>
  setDoc(doc(collection(db, 'logs')), data)
const keys = (n: number) => Object.fromEntries(Array.from({ length: n }, (_, i) => [`k${i}`, i]))

describe('L1-5 creating a stored event', () => {
  it('James (either address) stores a well-formed event', async () => {
    await assertSucceeds(create(james(), event()))
    await assertSucceeds(create(jamesAlt(), event()))
  })

  const accepted: [string, Record<string, unknown>][] = [
    ...['DEBUG', 'INFO', 'ERROR', 'CRITICAL'].map(
      (severity) => [`severity ${severity}`, { severity }] as [string, Record<string, unknown>]
    ),
    ['env staging', { env: 'staging' }],
    ['env dev', { env: 'dev' }],
    ['audience client', { audience: 'client' }],
    ['audience both', { audience: 'both' }],
    ['no request id', { request_id: null, context: {} }],
    ['null client id', { client_id: null }],
    ['string trace and user ids', { trace_id: 't-1', user_id: 'u-1' }],
    ['a message of exactly 2000', { message: 'm'.repeat(2000) }],
    ['a context of exactly 30 keys', { context: keys(30) }],
    ['expireAt 31 days out', { expireAt: Timestamp.fromMillis(Date.now() + 31 * DAY - 60_000) }],
  ]
  for (const [what, over] of accepted)
    it(`accepts ${what}`, async () => {
      await assertSucceeds(create(james(), event(over)))
    })

  const refused: [string, Record<string, unknown>][] = [
    ['an unknown field', { extra: 1 }],
    ['severity NOTICE', { severity: 'NOTICE' }],
    ['severity in lower case', { severity: 'warning' }],
    ['source server', { source: 'server' }],
    ['source scorm', { source: 'scorm' }],
    ['env test', { env: 'test' }],
    ['audience public', { audience: 'public' }],
    ['an empty event type', { event_type: '' }],
    ['an event type of 65 characters', { event_type: 'e'.repeat(65) }],
    ['a message of 2001 characters', { message: 'm'.repeat(2001) }],
    ['a message that is not a string', { message: 42 }],
    ['a context of 31 keys', { context: keys(31) }],
    ['a context that is not a map', { context: 'target=firestore' }],
    ['a timestamp of 41 characters', { timestamp: 't'.repeat(41) }],
    ['a session id of 101 characters', { session_id: 's'.repeat(101) }],
    ['a ts that is not a number', { ts: '1800000000000' }],
    ['expireAt as a number', { expireAt: Date.now() + 30 * DAY }],
    ['expireAt in the past', { expireAt: Timestamp.fromMillis(Date.now() - 60_000) }],
    ['expireAt more than 31 days out', { expireAt: Timestamp.fromMillis(Date.now() + 32 * DAY) }],
    ['a request id of 101 characters', { request_id: 'r'.repeat(101) }],
    ['a request id that is a number', { request_id: 5 }],
    ['a trace id of 101 characters', { trace_id: 't'.repeat(101) }],
    ['a user id of 101 characters', { user_id: 'u'.repeat(101) }],
    ['a client id of 101 characters', { client_id: 'c'.repeat(101) }],
    ['an empty app id', { app_id: '' }],
    ['an app id of 65 characters', { app_id: 'a'.repeat(65) }],
    ['a schema version that is a string', { schema_version: '1' }],
    ['a taxonomy version that is a string', { taxonomy_version: '6' }],
  ]
  for (const [what, over] of refused)
    it(`refuses ${what}`, async () => {
      await assertFails(create(james(), event(over)))
    })

  it('refuses an event missing any one of its fields', async () => {
    for (const key of Object.keys(event())) {
      const { [key]: _gone, ...rest }: Record<string, unknown> = event()
      await assertFails(create(james(), rest))
    }
  })

  for (const [who, db] of others)
    it(`${who} cannot store an event`, async () => {
      await assertFails(create(db(), event()))
    })
})

describe('L1-5 a stored event is write-once and unreadable from any browser', () => {
  beforeEach(() =>
    env.withSecurityRulesDisabled(async (c) => {
      await setDoc(doc(c.firestore() as unknown as Firestore, 'logs/l1'), event())
    })
  )

  for (const [who, db] of [['James', james] as [string, () => Firestore], ...others])
    it(`${who} cannot read, list, change or delete it`, async () => {
      await assertFails(getDoc(doc(db(), 'logs/l1')))
      await assertFails(getDocs(collection(db(), 'logs')))
      await assertFails(updateDoc(doc(db(), 'logs/l1'), { message: 'edited' }))
      await assertFails(setDoc(doc(db(), 'logs/l1'), event({ message: 'overwritten' })))
      await assertFails(deleteDoc(doc(db(), 'logs/l1')))
    })
})
