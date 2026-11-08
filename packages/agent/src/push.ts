// Sending decision notices to James's devices (docs/features/decision-notifications.md). A session
// that puts a decision on the board (a spec for approval, a question) sends one notification to
// every registered browser. Sending never fails the session's tool call: a failure is a WARNING
// readable through kanban_logs, and a token the push service no longer knows is dropped.
import { getMessaging } from 'firebase-admin/messaging'
import type { DocumentReference, Firestore } from 'firebase-admin/firestore'
import { z } from 'zod'
import { COLLECTIONS as C, decisionNotice, type DecisionNotice, type Task } from '@kanban/shared'
import { errorStatus, logFailure } from './app-log.ts'

export type PushOutcome =
  { token: string; ok: true } | { token: string; ok: false; code: string; unregistered: boolean }
type FailedOutcome = Extract<PushOutcome, { ok: false }>

export interface PushPort {
  sendDecision(notice: DecisionNotice, tokens: string[]): Promise<PushOutcome[]>
}

// The push service's answers for a token that will never work again.
const UNREGISTERED_CODES: readonly string[] = [
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
]

// Firebase Cloud Messaging through firebase-admin, as data-only web pushes (public/sw.js shows
// them). Against the Firestore emulator it sends nothing and reports every token ok, so no test
// run reaches the real push service.
export function fcmPush(): PushPort {
  return {
    async sendDecision(notice, tokens) {
      if (process.env.FIRESTORE_EMULATOR_HOST)
        return tokens.map((token): PushOutcome => ({ token, ok: true }))
      const { title, body, tag, url } = notice
      const batch = await getMessaging().sendEachForMulticast({
        tokens,
        webpush: { data: { title, body, tag, url }, headers: { Urgency: 'high' } },
      })
      return batch.responses.map((r, i): PushOutcome => {
        const token = tokens[i]
        if (r.success) return { token, ok: true }
        const code = r.error?.code ?? 'unknown'
        return { token, ok: false, code, unregistered: UNREGISTERED_CODES.includes(code) }
      })
    },
  }
}

// A device record as the agent uses it: only a non-empty string token counts.
const DeviceDoc = z.object({ token: z.string().min(1) })
interface DeviceRecord {
  ref: DocumentReference
  token: string
}

async function readDevices(db: Firestore): Promise<DeviceRecord[]> {
  const snap = await db.collection(C.devices).get()
  return snap.docs.flatMap((d) => {
    const parsed = DeviceDoc.safeParse(d.data())
    return parsed.success ? [{ ref: d.ref, token: parsed.data.token }] : []
  })
}

async function projectName(db: Firestore, projectId: string): Promise<string> {
  const name: unknown = (await db.collection(C.projects).doc(projectId).get()).get('name')
  return typeof name === 'string' && name !== '' ? name : projectId
}

// Deletes every record holding a token the push service reported unregistered; how many went.
async function removeUnregistered(
  db: Firestore,
  devices: readonly DeviceRecord[],
  failed: readonly FailedOutcome[]
): Promise<number> {
  const dead = new Set(failed.filter((o) => o.unregistered).map((o) => o.token))
  const gone = devices.filter((d) => dead.has(d.token))
  if (gone.length === 0) return 0
  const batch = db.batch()
  for (const d of gone) batch.delete(d.ref)
  await batch.commit()
  return gone.length
}

interface SendFailure {
  taskId: string
  status: string | number
  deviceCount: number
  removed: number
  detail: string
}

const reportFailure = (f: SendFailure) =>
  logFailure({
    severity: 'WARNING',
    event_type: 'api_call_failed',
    message: `decision notification for task ${f.taskId} failed: ${f.detail}`,
    context: {
      target: 'fcm',
      status: f.status,
      task_id: f.taskId,
      device_count: f.deviceCount,
      removed: f.removed,
    },
  })

// Sends the decision `task` now waits on to every registered device (nothing without one, or
// when the task waits on no decision). `specBody` is the spec brief posted with a spec. Resolves
// once sent, dead tokens dropped and any failure logged; it never rejects.
export async function notifyDecision(
  db: Firestore,
  push: PushPort,
  task: Pick<Task, 'id' | 'title' | 'stage' | 'needs' | 'projectId'>,
  specBody?: string
): Promise<void> {
  let deviceCount = 0
  try {
    const devices = await readDevices(db)
    deviceCount = devices.length
    if (devices.length === 0) return
    const notice = decisionNotice(task, await projectName(db, task.projectId), specBody)
    if (!notice) return
    const outcomes = await push.sendDecision(notice, [...new Set(devices.map((d) => d.token))])
    const failed = outcomes.filter((o): o is FailedOutcome => !o.ok)
    if (failed.length === 0) return
    await reportFailure({
      taskId: task.id,
      status: failed[0].code,
      deviceCount,
      removed: await removeUnregistered(db, devices, failed),
      detail: `${failed.length} of ${outcomes.length} devices refused`,
    })
  } catch (err) {
    await reportFailure({
      taskId: task.id,
      status: errorStatus(err),
      deviceCount,
      removed: 0,
      detail: err instanceof Error ? err.message : String(err),
    })
  }
}
