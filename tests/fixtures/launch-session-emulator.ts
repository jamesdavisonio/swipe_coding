// Shared setup for the launch-session agent suites (tests/emulator/launch-session-*.test.ts): a
// real notifier (startNotifier) on the Firestore emulator with a fake push port and a fake
// LaunchPort that records every request, so no suite ever starts a real `claude` process.
// Run with `npm run test:rules` (project demo-kanban). Tasks and projects are written with the
// Admin SDK, as the phone's request would arrive; folders are real temp folders.
import { mkdirSync, mkdtempSync } from 'node:fs'
import { hostname, tmpdir } from 'node:os'
import { join } from 'node:path'
import type { DocumentData } from 'firebase-admin/firestore'
import type { Task } from '../../packages/shared/src/index.ts'
import type { LaunchPort, LaunchRequest } from '../../packages/agent/src/launcher.ts'
import { startNotifier, type Notifier } from '../../packages/agent/src/notifier.ts'
import { adminDb } from './app-logs-emulator.ts'
import { fakePush, putTask, waitFor } from './board-briefs-b7-emulator.ts'

export type Db = Awaited<ReturnType<typeof adminDb>>
export { adminDb, waitFor }

// ---- the fake LaunchPort ----------------------------------------------------------------------

export interface FakeLaunch extends LaunchPort {
  calls: LaunchRequest[]
  // What start() answers; the default resolves { sessionId: 'sess-<n>' }.
  behave: (req: LaunchRequest) => Promise<{ sessionId: string }>
  reset(): void
}
export function fakeLaunch(): FakeLaunch {
  let n = 0
  const ok = () => Promise.resolve({ sessionId: `sess-${++n}` })
  const port: FakeLaunch = {
    calls: [],
    behave: ok,
    reset() {
      port.calls.length = 0
      port.behave = ok
    },
    start(req) {
      port.calls.push({ ...req })
      return port.behave(req)
    },
  }
  return port
}
// The requests the port got for one task (the first message names the task id).
export const callsFor = (port: FakeLaunch, taskId: string) =>
  port.calls.filter((c) => c.prompt.includes(taskId))

// ---- folders and projects ---------------------------------------------------------------------

export type FolderKind = 'git' | 'plain' | 'missing'
export function folder(kind: FolderKind): string {
  const dir = mkdtempSync(join(tmpdir(), 'launch-session-'))
  if (kind === 'git') mkdirSync(join(dir, '.git'))
  if (kind === 'missing') return join(dir, 'does-not-exist')
  return dir
}

const projectIds: string[] = []
// A project on `host` (default: this PC) whose folder is `cwd`; returns its id.
export async function putProject(
  db: Db,
  o: { cwd?: string; host?: string; name?: string } = {}
): Promise<string> {
  const ref = db.collection('projects').doc()
  const t = Date.now()
  await ref.set({
    hostname: o.host ?? hostname(),
    cwd: o.cwd ?? folder('plain'),
    name: o.name ?? `launch-${ref.id}`,
    createdAt: t,
    updatedAt: t,
  })
  projectIds.push(ref.id)
  return ref.id
}

// A task of `projectId` written with the Admin SDK; `launch` is stored when given.
export function putLaunchTask(
  db: Db,
  projectId: string,
  launch: Record<string, unknown> | undefined,
  over: Record<string, unknown> = {}
): Promise<Task> {
  const fields = { projectId, ...(launch ? { launch } : {}), ...over }
  return putTask(db, fields as Partial<Omit<Task, 'id'>>)
}
export const requested = (): Record<string, unknown> => ({
  state: 'requested',
  requestedAt: Date.now(),
})

export async function readLaunch(db: Db, taskId: string): Promise<DocumentData | undefined> {
  return (await db.collection('tasks').doc(taskId).get()).get('launch') as DocumentData | undefined
}
export const launchState = async (db: Db, taskId: string) => (await readLaunch(db, taskId))?.state

// Resolves once the task's launch has `state`.
export const waitForState = (db: Db, taskId: string, state: string) =>
  waitFor(
    async () => ((await launchState(db, taskId)) === state ? readLaunch(db, taskId) : null),
    `task ${taskId} launch.state ${state}`
  )

export async function readComments(db: Db, taskId: string): Promise<DocumentData[]> {
  const snap = await db.collection('comments').where('taskId', '==', taskId).get()
  return snap.docs.map((d) => d.data())
}

// "Nothing happened" is shown with a barrier: a fresh request on this PC that must be started (or
// failed) is awaited after the actions under test; the notifier handles changes in the order they
// were written, so everything those actions would have caused has happened by then.
export async function barrier(db: Db): Promise<Task> {
  const p = await putProject(db)
  const t = await putLaunchTask(db, p, requested())
  await waitFor(
    async () => ['started', 'failed'].includes(await launchState(db, t.id)),
    'the barrier request to be handled'
  )
  return t
}

// ---- the notifier -----------------------------------------------------------------------------

// Removes this suite family's leftovers (every task that has a launch, the projects made here and
// the lease) so no other file's request is started by this file's notifier.
export async function clearLaunchData(db: Db): Promise<void> {
  const snap = await db
    .collection('tasks')
    .where('launch.state', 'in', ['requested', 'starting', 'started', 'failed'])
    .get()
  for (const d of snap.docs) await d.ref.delete()
  for (const id of projectIds.splice(0)) await db.collection('projects').doc(id).delete()
  await db.recursiveDelete(db.collection('notifier'))
}

export const push = fakePush()
const running: Notifier[] = []

// Starts a notifier with the fake push and `launch`; stopAll() stops every one this file started.
export async function startWith(db: Db, launch: LaunchPort, extra: Record<string, unknown> = {}) {
  const n = await startNotifier({ db, push, launch, ...extra })
  running.push(n)
  return n
}
export async function stopAll(): Promise<void> {
  for (const n of running.splice(0)) await n.stop()
}
