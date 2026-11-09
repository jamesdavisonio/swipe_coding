// Shared setup for the pr-ready agent suites (tests/emulator/pr-ready-*.test.ts): a real notifier
// (startNotifier) on the Firestore emulator with a fake push port, a fake LaunchPort and a fake
// GithubPort whose answers each test controls per PR url, so no suite ever calls the real `gh`.
// Time is a clock the test moves (`now` option); polling is fast (prPollMs). Run with
// `npm run test:rules` (project demo-kanban).
import type { Task } from '../../packages/shared/src/index.ts'
import type { GithubPort, PrStatus } from '../../packages/agent/src/github.ts'
import {
  clearDevices,
  patchTask,
  putTask,
  waitFor,
  NOTIFIER_PROJECT,
} from './board-briefs-b7-emulator.ts'
import {
  adminDb,
  fakeLaunch,
  push,
  startWith,
  stopAll,
  type Db,
} from './launch-session-emulator.ts'

export { adminDb, push, stopAll, waitFor, patchTask, putTask, NOTIFIER_PROJECT, type Db }
export { readComments } from './launch-session-emulator.ts'

// ---- the fake GithubPort ----------------------------------------------------------------------

export type Check = PrStatus['checks'][number]
export const ok = (name: string): Check => ({ name, status: 'COMPLETED', conclusion: 'SUCCESS' })
export const done = (name: string, conclusion: string): Check => ({
  name,
  status: 'COMPLETED',
  conclusion,
})
export const running = (name: string): Check => ({ name, status: 'PENDING', conclusion: '' })

export const status = (over: Partial<PrStatus> = {}): PrStatus => ({
  state: 'OPEN',
  mergeable: 'MERGEABLE',
  head: 'aaa111',
  checks: [ok('fast-feedback')],
  ...over,
})

export interface FakeGithub extends GithubPort {
  // Every url asked, in order.
  calls: string[]
  // What `url` answers from now on: a status, or an error to reject with.
  answer(url: string, a: PrStatus | Error): void
  count(url: string): number
  reset(): void
}
export function fakeGithub(): FakeGithub {
  const answers = new Map<string, PrStatus | Error>()
  const gh: FakeGithub = {
    calls: [],
    answer: (url, a) => void answers.set(url, a),
    count: (url) => gh.calls.filter((c) => c === url).length,
    reset() {
      gh.calls.length = 0
      answers.clear()
    },
    prStatus(url) {
      gh.calls.push(url)
      // An url nobody set up (another suite's leftover) stays pending forever.
      const a = answers.get(url) ?? status({ mergeable: 'UNKNOWN', checks: [running('other')] })
      return a instanceof Error ? Promise.reject(a) : Promise.resolve(a)
    },
  }
  return gh
}
export const readError = (code: string) =>
  Object.assign(new Error(`gh failed: ${code}`), { code }) as Error

// ---- the clock and the notifier ---------------------------------------------------------------

export const clock = { t: Date.now() }
export const MINUTE = 60_000
export const PR_GRACE_MS = 120_000
export const GIVE_UP_MS = 1_800_000
export const POLL_MS = 25

let seq = 0
export const prUrl = () => `https://github.com/jamesdavisonio/kanban/pull/${1000 + ++seq}`
export const prNumber = (url: string) => Number(url.split('/').pop())

// Starts a notifier with the fake ports and the moving clock; stopAll() stops it.
export function startReady(db: Db, github: GithubPort, extra: Record<string, unknown> = {}) {
  return startWith(db, fakeLaunch(), {
    github,
    prPollMs: POLL_MS,
    noChecksGraceMs: PR_GRACE_MS,
    githubGiveUpMs: GIVE_UP_MS,
    now: () => clock.t,
    ...extra,
  })
}

// Removes every PR task this suite family wrote (a leftover pending task would be polled by other
// suites' notifiers, which use the real gh) and the lease.
export async function clearPrData(db: Db): Promise<void> {
  const snap = await db
    .collection('tasks')
    .where('pr.checks', 'in', ['pending', 'passed', 'failed', 'closed'])
    .get()
  for (const d of snap.docs) await d.ref.delete()
  await db.recursiveDelete(db.collection('notifier'))
  await clearDevices(db)
}

// A task on `stage` with its PR watched from `since` (default: now on the test clock).
export function prTask(
  db: Db,
  url: string,
  over: Partial<Omit<Task, 'id'>> = {},
  pr: Record<string, unknown> = {}
): Promise<Task> {
  return putTask(db, {
    stage: 'pr',
    needs: null,
    pr: { number: prNumber(url), url, checks: 'pending', pendingSince: clock.t, ...pr } as never,
    ...over,
  })
}

export async function readTask(db: Db, id: string) {
  return (await db.collection('tasks').doc(id).get()).data() as Omit<Task, 'id'>
}

// Resolves with the task once `pred` holds for it.
export const waitForTask = (
  db: Db,
  id: string,
  pred: (t: Omit<Task, 'id'>) => boolean,
  what: string
) =>
  waitFor(async () => {
    const t = await readTask(db, id)
    return pred(t) ? t : null
  }, `task ${id}: ${what}`)

// "Nothing more happened" is shown with a barrier: a PR of its own that passes is awaited after the
// actions under test (the notifier handles changes in order).
export async function barrier(db: Db, github: FakeGithub): Promise<void> {
  const b = prUrl()
  github.answer(b, status())
  const t = await prTask(db, b)
  await waitForTask(db, t.id, (x) => x.needs?.kind === 'pr', 'the barrier PR to pass')
}

// The notifier has read `url` n more times than when this was called and handled the answers (the
// next read has begun), then a barrier. Counting from the call means a read at a clock or answer set
// just before it is seen.
export async function polledTimes(db: Db, github: FakeGithub, url: string, n: number) {
  const from = github.count(url)
  await waitFor(
    () => Promise.resolve(github.count(url) >= from + n + 1),
    `${n + 1} more reads of ${url}`
  )
  await barrier(db, github)
}
