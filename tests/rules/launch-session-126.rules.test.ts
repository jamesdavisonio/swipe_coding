// launch-session 126, behaviourally in the Firestore emulator (`npm run test:rules`): the signed-in
// owner can create a task with `launch` only as { state: 'requested', requestedAt: <number> }, and
// can never change `launch` afterwards (set it, alter it or remove it); other edits of the task
// still work. Only the PC (Admin SDK, which bypasses the rules) moves it on.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { deleteField, doc, setDoc, updateDoc, type Firestore } from 'firebase/firestore'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import { initialTaskFields } from '../../packages/shared/src/index.ts'

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

const james = () =>
  env
    .authenticatedContext('james-uid', { email: 'j@nullnoise.ai', email_verified: true })
    .firestore() as unknown as Firestore
const stranger = () =>
  env
    .authenticatedContext('someone', { email: 'someone@example.com', email_verified: true })
    .firestore() as unknown as Firestore

const task = (launch?: unknown) => ({
  ...initialTaskFields({
    projectId: 'p1',
    type: 'feature',
    title: 'Start from the phone',
    description: 'An idea.',
    createdBy: 'james',
    afterDeploy: [],
    now: 1_800_000_000_000,
  }),
  log: [{ at: 1_800_000_000_000, who: 'james', text: 'Queued: Start from the phone' }],
  ...(launch === undefined ? {} : { launch }),
})
const REQUESTED = { state: 'requested', requestedAt: 1_800_000_000_000 }
const seed = (launch?: unknown) =>
  env.withSecurityRulesDisabled(async (c) => {
    await setDoc(doc(c.firestore() as unknown as Firestore, 'tasks', 't1'), task(launch))
  })

describe('launch-session 126: creating a task with launch', () => {
  it('accepts exactly { state: requested, requestedAt: <number> }', async () => {
    await assertSucceeds(setDoc(doc(james(), 'tasks', 't1'), task(REQUESTED)))
  })

  it('still accepts a task with no launch', async () => {
    await assertSucceeds(setDoc(doc(james(), 'tasks', 't1'), task()))
  })

  const refused: [string, unknown][] = [
    ['state starting', { ...REQUESTED, state: 'starting' }],
    ['state started', { ...REQUESTED, state: 'started' }],
    ['state failed', { ...REQUESTED, state: 'failed' }],
    ['an unknown state', { ...REQUESTED, state: 'queued' }],
    ['no state', { requestedAt: 1_800_000_000_000 }],
    ['no requestedAt', { state: 'requested' }],
    ['a requestedAt that is a string', { state: 'requested', requestedAt: '1800000000000' }],
    ['a requestedAt that is null', { state: 'requested', requestedAt: null }],
    ['a startedAt', { ...REQUESTED, startedAt: 1_800_000_000_001 }],
    ['a failedAt', { ...REQUESTED, failedAt: 1_800_000_000_001 }],
    ['a sessionId', { ...REQUESTED, sessionId: 'abc' }],
    ['a reason', { ...REQUESTED, reason: 'because' }],
    ['an extra field', { ...REQUESTED, extra: true }],
    ['a launch that is a string', 'requested'],
    ['a launch that is true', true],
    ['a launch that is null', null],
    ['an empty launch', {}],
  ]
  for (const [what, launch] of refused)
    it(`refuses a task with ${what}`, async () => {
      await assertFails(setDoc(doc(james(), 'tasks', 'bad'), task(launch)))
    })
})

describe('launch-session 126: launch never changes afterwards', () => {
  it('refuses to add launch to a task that has none', async () => {
    await seed()
    await assertFails(updateDoc(doc(james(), 'tasks', 't1'), { launch: REQUESTED }))
  })

  it.each([
    ['state to started', { 'launch.state': 'started' }],
    ['state to starting', { 'launch.state': 'starting' }],
    ['state to failed', { 'launch.state': 'failed' }],
    ['requestedAt', { 'launch.requestedAt': 1 }],
    ['startedAt', { 'launch.startedAt': 1_800_000_000_002 }],
    ['sessionId', { 'launch.sessionId': 'mine' }],
    ['reason', { 'launch.reason': 'mine' }],
  ])('refuses to change launch: %s', async (_what, patch) => {
    await seed(REQUESTED)
    await assertFails(updateDoc(doc(james(), 'tasks', 't1'), patch))
  })

  it('refuses to replace launch with another value', async () => {
    await seed(REQUESTED)
    await assertFails(
      updateDoc(doc(james(), 'tasks', 't1'), {
        launch: { state: 'requested', requestedAt: 1_800_000_999_999 },
      })
    )
  })

  it('refuses to remove launch', async () => {
    await seed(REQUESTED)
    await assertFails(updateDoc(doc(james(), 'tasks', 't1'), { launch: deleteField() }))
  })

  it('refuses to change a launch the PC already moved on', async () => {
    await seed({ state: 'started', requestedAt: 1, startedAt: 2, sessionId: 's' })
    await assertFails(updateDoc(doc(james(), 'tasks', 't1'), { 'launch.state': 'requested' }))
    await assertFails(updateDoc(doc(james(), 'tasks', 't1'), { launch: deleteField() }))
  })

  it('still lets James edit the rest of the task, with or without launch', async () => {
    await seed(REQUESTED)
    await assertSucceeds(
      updateDoc(doc(james(), 'tasks', 't1'), { stage: 'build', unread: true, updatedAt: 5 })
    )
    await env.clearFirestore()
    await seed()
    await assertSucceeds(updateDoc(doc(james(), 'tasks', 't1'), { stage: 'build', updatedAt: 5 }))
  })
})

describe('launch-session 126: everyone else', () => {
  it('a stranger cannot create a task with launch', async () => {
    await assertFails(setDoc(doc(stranger(), 'tasks', 't1'), task(REQUESTED)))
  })
})
