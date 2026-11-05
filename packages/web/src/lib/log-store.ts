// The browser logger's transport: stores each batch of events in the board's `logs` collection
// (docs/features/app-logs.md). Nothing here may block, throw into or log about the app: a
// signed-out browser stores nothing, and a failed or refused commit is dropped silently.
import { boundedLogFields, LOG_RETENTION_MS, type LoggerEvent } from '@kanban/shared'
import { Timestamp, collection, doc, writeBatch } from 'firebase/firestore'
import { auth, db } from '../firebase.ts'

export function storeLogEvents(events: LoggerEvent[]): Promise<void> {
  try {
    if (!auth.currentUser || events.length === 0) return Promise.resolve()
    const batch = writeBatch(db)
    for (const e of events) {
      const fields = boundedLogFields(e)
      batch.set(doc(collection(db, 'logs')), {
        ...fields,
        expireAt: Timestamp.fromMillis(fields.ts + LOG_RETENTION_MS),
      })
    }
    // Handed over, not awaited: offline the commit stays pending and syncs later. A refused
    // commit is dropped on purpose; logging about the failure of logging is forbidden (L1-3).
    void batch.commit().catch(() => undefined)
  } catch {
    // A synchronous failure (bad event, Firestore not ready) must never reach the page.
    return Promise.resolve()
  }
  return Promise.resolve()
}
