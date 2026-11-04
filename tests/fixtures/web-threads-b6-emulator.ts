// Shared helpers for the web-threads B6 emulator suites (tests/emulator/web-threads-b6-*.test.ts).
// Builds on the B4 emulator fixture, which owns the emulator lifecycle (useEmulator), the mocked
// firebase.ts and logger, and the task, comment and archive read-backs; this adds a done task
// and seeding of a task's log archive (as James, through the real rules). Run with
// `npm run test:rules` (project demo-kanban).
import { collection, doc, setDoc } from 'firebase/firestore'
import type { LogEntry, Task } from '../../packages/shared/src/index.ts'
import { T0, jamesDb, makeTask } from './web-threads-b4-emulator.ts'

export const DAY = 24 * 60 * 60 * 1000

// A feature that finished a month before T0: stage done, no need, no session working on it.
export const doneTask = (over: Partial<Task> = {}): Task =>
  makeTask('t1', {
    title: 'Ship the nav',
    stage: 'done',
    doneAt: T0 - 30 * DAY,
    needs: null,
    working: false,
    summary: 'The nav ships on every page.',
    log: [{ at: T0 - 30 * DAY, who: 'system', text: 'Done' }],
    ...over,
  })

// Writes each entry as its own document under tasks/{taskId}/log_archive, in the given order.
export async function seedArchive(taskId: string, entries: readonly LogEntry[]) {
  for (const e of entries)
    await setDoc(doc(collection(jamesDb(), 'tasks', taskId, 'log_archive')), e)
}
