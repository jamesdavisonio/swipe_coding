// web-threads B1, criterion 4, behaviourally in the Firestore emulator (`npm run test:rules`).
// Real reads/writes from signed-in browser principals against firestore.rules.
//
// Red evidence today (current firestore.rules):
// - James writes/reads tasks/{id}/log_archive/{entry}: no rule allows the subcollection.
// - James refused on every session kind and an unknown kind: create does not restrict kinds.
// - James cannot change a sent comment's kind, to a session kind or to another James kind
//   ('comment' → 'approve'): update only checks author == 'james', never kind.
// Regression guards that pass today: owner writes and owner read-backs of comments (both
// authors), todos and projects (clause 1), other principals refused (4),
// agents read-only (5), default deny (6), the `author: 'agent'` refusals, James cannot
// change a sent comment's author (today's update rule already requires author 'james' on
// the new document), and other principals refused on the archive (default deny refuses it
// today; the new archive rule must keep it refused). Editing/deleting sent comments is out
// of scope for the feature.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { deleteDoc, doc, getDoc, setDoc, updateDoc, type Firestore } from 'firebase/firestore'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

const JAMES_KINDS = ['comment', 'answer', 'approve', 'change_request', 'merged', 'reopen']
const SESSION_KINDS = ['spec', 'question', 'pr', 'after_deploy', 'done', 'info', 'system']

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

const now = 1_800_000_000_000
const task = {
  projectId: 'p1',
  agentId: null,
  type: 'feature',
  title: 'T',
  description: 'D',
  stage: 'spec',
  needs: null,
  spec: null,
  afterDeploy: ['Run smoke'],
  afterDone: [false],
  pr: null,
  summary: '',
  createdBy: 'james',
  createdAt: now,
  updatedAt: now,
  doneAt: null,
  reopenedAt: null,
  unread: false,
  working: false,
  lastCommentAt: null,
  log: [],
}
const comment = (author: string, kind: string) => ({
  taskId: 't1',
  projectId: 'p1',
  agentId: null,
  author,
  kind,
  body: 'hi',
  createdAt: now,
  deliveredAt: null,
  workingAt: null,
  handledAt: null,
})
const seed = (docs: Record<string, Record<string, unknown>>) =>
  env.withSecurityRulesDisabled(async (c) => {
    const db = c.firestore() as unknown as Firestore
    for (const [path, data] of Object.entries(docs)) await setDoc(doc(db, path), data)
  })

describe('owner writes the new task fields, todos and projects', () => {
  for (const [who, db] of [
    ['j@nullnoise.ai', james],
    ['james@nullnoise.ai', jamesAlt],
  ] as const) {
    it(`${who} creates a task with the new fields and reads it back`, async () => {
      await assertSucceeds(setDoc(doc(db(), 'tasks/t1'), task))
      const snap = await assertSucceeds(getDoc(doc(db(), 'tasks/t1')))
      expect(snap.data()).toEqual(task)
    })
  }

  it('updates stage, needs, afterDone, log, doneAt and reopenedAt on an existing task', async () => {
    await seed({ 'tasks/t1': task })
    const change = {
      stage: 'done',
      needs: { kind: 'question', question: 'Which?', options: [{ key: 'a', label: 'A' }] },
      afterDone: [true],
      log: [{ at: now, who: 'james', text: 'Merged' }],
      doneAt: now + 1,
      reopenedAt: now + 2,
    }
    await assertSucceeds(updateDoc(doc(james(), 'tasks/t1'), change))
    const snap = await assertSucceeds(getDoc(doc(james(), 'tasks/t1')))
    expect(snap.data()).toEqual({ ...task, ...change })
  })

  it('creates, updates and deletes a todo', async () => {
    const ref = doc(james(), 'todos/x1')
    await assertSucceeds(
      setDoc(ref, {
        projectId: 'p1',
        body: 'Do it',
        link: null,
        done: false,
        sourceTaskId: null,
        createdAt: now,
        doneAt: null,
      })
    )
    await assertSucceeds(updateDoc(ref, { done: true, doneAt: now }))
    await assertSucceeds(deleteDoc(ref))
  })

  it('creates a project', async () => {
    await assertSucceeds(
      setDoc(doc(james(), 'projects/p1'), {
        hostname: 'h',
        cwd: 'c',
        name: 'n',
        createdAt: now,
        updatedAt: now,
      })
    )
  })

  it('reads back seeded comments (both authors), a todo and a project', async () => {
    await seed({
      'comments/j1': comment('james', 'comment'),
      'comments/a1': comment('agent', 'question'),
      'todos/x1': { projectId: 'p1', body: 'b', done: false },
      'projects/p1': { name: 'n' },
    })
    for (const path of ['comments/j1', 'comments/a1', 'todos/x1', 'projects/p1'])
      await assertSucceeds(getDoc(doc(james(), path)))
  })
})

describe('comment kinds', () => {
  for (const kind of JAMES_KINDS)
    it(`James sends a "${kind}" comment`, async () => {
      await assertSucceeds(setDoc(doc(james(), 'comments/c1'), comment('james', kind)))
    })

  for (const kind of [...SESSION_KINDS, 'bogus'])
    it(`James cannot send a "${kind}" comment (not a James kind)`, async () => {
      await assertFails(setDoc(doc(james(), 'comments/c1'), comment('james', kind)))
    })

  it('a comment authored as the agent is refused whatever the kind', async () => {
    for (const kind of [...JAMES_KINDS, ...SESSION_KINDS])
      await assertFails(setDoc(doc(james(), `comments/${kind}`), comment('agent', kind)))
  })

  it("James cannot edit the agent's comment", async () => {
    await seed({ 'comments/c2': comment('agent', 'question') })
    await assertFails(updateDoc(doc(james(), 'comments/c2'), { body: 'edited' }))
  })

  it("James cannot change a sent comment's kind", async () => {
    await seed({ 'comments/j1': comment('james', 'comment') })
    await assertFails(updateDoc(doc(james(), 'comments/j1'), { kind: 'spec' }))
  })

  it("James cannot change a sent comment's kind to another James kind", async () => {
    await seed({ 'comments/j1': comment('james', 'comment') })
    await assertFails(updateDoc(doc(james(), 'comments/j1'), { kind: 'approve' }))
  })

  it("James cannot change a sent comment's author", async () => {
    await seed({ 'comments/j1': comment('james', 'comment') })
    await assertFails(updateDoc(doc(james(), 'comments/j1'), { author: 'agent' }))
  })
})

describe('archived task log', () => {
  const entry = { at: now, who: 'session', text: 'old entry' }

  it('James writes and reads an archive entry under its task', async () => {
    await assertSucceeds(setDoc(doc(james(), 'tasks/t1/log_archive/e1'), entry))
    const snap = await assertSucceeds(getDoc(doc(james(), 'tasks/t1/log_archive/e1')))
    expect(snap.data()).toEqual(entry)
  })

  for (const [who, db] of others)
    it(`${who} can neither read nor write it`, async () => {
      await seed({ 'tasks/t1/log_archive/e1': entry })
      await assertFails(getDoc(doc(db(), 'tasks/t1/log_archive/e1')))
      await assertFails(setDoc(doc(db(), 'tasks/t1/log_archive/e1'), entry))
    })
})

describe('any other principal is refused', () => {
  beforeEach(() =>
    seed({
      'tasks/t1': task,
      'todos/x1': { projectId: 'p1', body: 'b', done: false },
      'projects/p1': { name: 'n' },
      'agents/a1': { projectId: 'p1', lastSeen: now },
      'comments/j1': comment('james', 'comment'),
    })
  )

  for (const [who, db] of others)
    it(`${who}: refused on tasks, comments, todos, projects and agents`, async () => {
      await assertFails(getDoc(doc(db(), 'tasks/t1')))
      await assertFails(setDoc(doc(db(), 'tasks/t2'), task))
      await assertFails(
        updateDoc(doc(db(), 'tasks/t1'), { stage: 'build', needs: null, doneAt: now })
      )
      await assertFails(setDoc(doc(db(), 'comments/c1'), comment('james', 'comment')))
      await assertFails(getDoc(doc(db(), 'todos/x1')))
      await assertFails(setDoc(doc(db(), 'todos/x2'), { projectId: 'p1', body: 'b', done: false }))
      await assertFails(updateDoc(doc(db(), 'todos/x1'), { done: true }))
      await assertFails(getDoc(doc(db(), 'projects/p1')))
      await assertFails(setDoc(doc(db(), 'projects/p2'), { name: 'n' }))
      await assertFails(updateDoc(doc(db(), 'projects/p1'), { name: 'renamed' }))
      await assertFails(getDoc(doc(db(), 'agents/a1')))
      await assertFails(setDoc(doc(db(), 'agents/a1'), { projectId: 'p1', lastSeen: now + 1 }))
      await assertFails(getDoc(doc(db(), 'comments/j1')))
      await assertFails(updateDoc(doc(db(), 'comments/j1'), { body: 'edited' }))
      await assertFails(deleteDoc(doc(db(), 'comments/j1')))
      for (const path of ['tasks/t1', 'todos/x1', 'projects/p1'])
        await assertFails(deleteDoc(doc(db(), path)))
    })
})

describe('agents stay read-only from the browser', () => {
  it('James reads an agent but cannot create, update or delete one', async () => {
    await seed({ 'agents/a1': { projectId: 'p1', lastSeen: now } })
    await assertSucceeds(getDoc(doc(james(), 'agents/a1')))
    await assertFails(setDoc(doc(james(), 'agents/a2'), { projectId: 'p1', lastSeen: now }))
    await assertFails(updateDoc(doc(james(), 'agents/a1'), { lastSeen: now + 1 }))
    await assertFails(deleteDoc(doc(james(), 'agents/a1')))
  })
})

describe('default deny', () => {
  it('James is refused on a collection the rules do not name', async () => {
    await assertFails(setDoc(doc(james(), 'secrets/x'), { v: 1 }))
    await assertFails(getDoc(doc(james(), 'secrets/x')))
  })
})
