// notifier 112 (instrumentation, listener side) in the Firestore emulator (`npm run test:rules`):
// when the notifier's tasks listener fails it stores one ERROR api_call_failed (target firestore,
// status) and re-creates the listener after retryMs, so a later decision is still sent. The db is
// wrapped so that the first onSnapshot on `tasks` reports an error and later ones are real.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { startNotifier } from '../../packages/agent/src/notifier.ts'
import { adminDb, agentLogs, waitForLog } from '../fixtures/app-logs-emulator.ts'
import {
  clearDevices,
  fakePush,
  putTask,
  seedDevices,
  waitForSends,
} from '../fixtures/board-briefs-b7-emulator.ts'

type Db = Awaited<ReturnType<typeof adminDb>>
const CODE = `test/listener-died-${Date.now()}`

// `db` whose `tasks` collection - and every query or document built from it (where, orderBy,
// select, limit, doc, ...) - fails the first onSnapshot with CODE (reported asynchronously).
function dyingListener(db: Db, died: { count: number }): Db {
  type Fn = (...a: unknown[]) => unknown
  const hasSnapshot = (v: unknown): v is { onSnapshot: Fn } =>
    typeof v === 'object' &&
    v !== null &&
    typeof (v as { onSnapshot?: unknown }).onSnapshot === 'function'
  const wrap = <T extends object>(target: T): T =>
    new Proxy(target, {
      get(t, prop) {
        const v = Reflect.get(t, prop, t) as unknown
        if (typeof v !== 'function') return v
        if (prop === 'onSnapshot')
          return (next: unknown, error?: (e: Error) => void) => {
            if (died.count === 0 && typeof error === 'function') {
              died.count++
              setTimeout(() => error(Object.assign(new Error('listener died'), { code: CODE })), 0)
              return () => {}
            }
            return (v as Fn).call(t, next, error)
          }
        return (...args: unknown[]) => {
          const r = (v as Fn).apply(t, args)
          return hasSnapshot(r) ? wrap(r) : r
        }
      },
    })
  return new Proxy(db, {
    get(t, prop) {
      const v = Reflect.get(t, prop, t) as unknown
      if (typeof v !== 'function') return v
      if (prop === 'collection')
        return (name: string) => (name === 'tasks' ? wrap(t.collection(name)) : t.collection(name))
      return (v as Fn).bind(t)
    },
  })
}

let db: Db
let notifier: { stop(): Promise<void> } | null = null
const push = fakePush()
beforeAll(async () => {
  db = await adminDb()
  await db.recursiveDelete(db.collection('notifier'))
  await seedDevices(db, ['tok-a'])
})
afterAll(async () => {
  await notifier?.stop()
  await clearDevices(db)
})

describe('notifier 112: the tasks listener dies', () => {
  it('stores an ERROR api_call_failed for firestore and keeps notifying after the retry', async () => {
    const died = { count: 0 }
    notifier = await startNotifier({ db: dyingListener(db, died), push, retryMs: 50 })
    const e = await waitForLog((x) => x.context?.status === CODE, 'the listener-died error', 10_000)
    expect(e).toMatchObject({
      severity: 'ERROR',
      event_type: 'api_call_failed',
      source: 'server',
      context: { target: 'firestore', status: CODE },
    })
    const t = await putTask(db, {
      needs: { kind: 'question', question: 'After the listener died?' },
    })
    const [call] = await waitForSends(push, t.id)
    expect(call.notice.body).toBe('After the listener died?')
    expect(died.count).toBe(1)
    expect(await agentLogs((x) => x.context?.status === CODE)).toHaveLength(1)
  })
})
