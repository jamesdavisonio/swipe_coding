# Test-author packet addendum — criterion 4 in the Firestore emulator

Same role, rules and boundaries as packet-test-author.md (read that first). The human chose to
install Java so criterion 4 can be tested behaviourally instead of by static text analysis.
Snapshot: branch feat/web-threads, uncommitted harness additions listed below.

## What changed in the harness (observed)

- `npm test` is now `vitest run` with `vitest.config.ts`: includes `tests/**/*.test.ts`,
  excludes `tests/rules/**`. Nothing else about the unit suite changed.
- New: `npm run test:rules` =
  `firebase emulators:exec --only firestore --project demo-kanban "vitest run --config vitest.rules.config.ts"`
  with `vitest.rules.config.ts` including `tests/rules/**/*.test.ts` (20 s test timeout,
  files run serially). `emulators:exec` starts the Firestore emulator on 127.0.0.1:8080 with
  `firestore.rules` from `firebase.json`, sets `FIRESTORE_EMULATOR_HOST`, runs the command,
  stops the emulator. Java 21 (Microsoft OpenJDK 21.0.13, zip distribution) is installed on
  this desktop at `C:\Users\Intel\Documents\tools\jdk-21` and is on the _user_ PATH, but
  shells already open in this session do not see it: prefix every emulator run with
  `PATH="/c/Users/Intel/Documents/tools/jdk-21/bin:$PATH"` (Git Bash). Verified: with that
  prefix `npm run test:rules` starts the emulator, loads `firestore.rules`, runs vitest, and
  today exits 1 only with "No test files found" (the file below does not exist yet). GitHub's
  ubuntu runners have Java preinstalled; CI runs this step after the contrast check.
- New dev dependency at the root: `@firebase/rules-unit-testing@^6` (peer: the `firebase`
  v12 client SDK already in `packages/web`, resolved from the root `node_modules`).

## The one new file

`tests/rules/web-threads-b1-4.rules.test.ts` — criterion 4, behaviourally:

> Given the Firestore rules, when James's signed-in browser writes the new fields (`stage`,
> `needs`, `afterDone`, `log`, `doneAt`, `reopenedAt`, comment kinds, todos), the write
> succeeds; when any other principal tries, it is refused; `agents` stays read-only from the
> browser.

Harness pattern (documented API of @firebase/rules-unit-testing v6; adapt, do not invent):

```ts
import { readFileSync } from 'node:fs'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, addDoc } from 'firebase/firestore'

let env: RulesTestEnvironment
beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-kanban',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  })
})
afterAll(() => env.cleanup())
beforeEach(() => env.clearFirestore())

// Principals:
const james = () =>
  env
    .authenticatedContext('james-uid', { email: 'j@nullnoise.ai', email_verified: true })
    .firestore()
const jamesAlt = () =>
  env
    .authenticatedContext('james-uid-2', { email: 'james@nullnoise.ai', email_verified: true })
    .firestore()
const unverified = () =>
  env
    .authenticatedContext('james-unverified', { email: 'j@nullnoise.ai', email_verified: false })
    .firestore()
const stranger = () =>
  env
    .authenticatedContext('someone', { email: 'someone@example.com', email_verified: true })
    .firestore()
const anon = () => env.unauthenticatedContext().firestore()
// Seeding past the rules: env.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), 'agents/a1'), {...}) })
```

Cases to cover (one `describe` per clause; use `assertSucceeds` / `assertFails` on the
promise of each operation):

1. **Owner writes succeed** — James (both e-mails) can `setDoc` a task document containing the
   new fields `stage`, `needs`, `afterDone`, `log`, `doneAt`, `reopenedAt` (use the shapes
   from the contract: e.g. `stage: 'spec', needs: null, afterDone: [], log: [], doneAt: null,
reopenedAt: null`), can `updateDoc` those fields on an existing task, can read it back and
   see the same values; can create/update/delete a todo; can create a project document.
2. **Comment kinds** — James can `setDoc` a comment with `author: 'james'` and each of the six
   kinds `comment, answer, approve, change_request, merged, reopen`; a comment with
   `author: 'james'` and kind `spec` (a session kind) is refused; a comment with
   `author: 'agent'` is refused whatever the kind; James can update/delete his own comment
   (author 'james') and cannot update a comment whose `author` is `'agent'` (seed it with
   rules disabled).
3. **Archive** — James can `setDoc` and read `tasks/{id}/log_archive/{entry}`; a stranger
   cannot read it.
4. **Other principals refused** — a stranger, an unverified-e-mail James, and an anonymous
   client are each refused on: reading a task, writing a task, creating a comment, reading a
   todo, reading a project, reading `agents`. (Seed the documents with rules disabled first so
   reads are refused by rules, not by absence.)
5. **Agents read-only** — James can read `agents/{id}` (seeded) and is refused on `setDoc`,
   `updateDoc` and `deleteDoc` of it.
6. **Default deny** — James is refused on a document in a collection the rules do not name
   (e.g. `secrets/x`).

Red evidence: with today's `firestore.rules` the archive cases and the "session kind refused"
case must FAIL (the rules do not yet restrict kinds or allow `log_archive`); the regression
clauses (1, 4, 5, 6 and the `author: 'agent'` refusal) pass today and are regression guards,
not red evidence — say so in a file-top comment. Run `npm run test:rules` and report its
verbatim tail. Keep the static tests in `tests/web-threads-b1-4.test.ts` as they are (they
remain cheap guards and the indexes test lives there).

Rules for this file are the same as the packet's: behavioural (assertSucceeds/assertFails
on real operations), exact kinds, no `.only`/`.skip`, no sleeps, no mocks of Firestore.
