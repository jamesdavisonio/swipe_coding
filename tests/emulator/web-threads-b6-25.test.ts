// @vitest-environment jsdom
// web-threads B6, criterion 25's archive read (useLogArchive), in the Firestore emulator (`npm run
// test:rules`): the History sheet's "Show earlier history" reads tasks/{id}/log_archive as James
// through the real rules. The hook is Live (loading, error, retry), returns the task's archived
// entries ordered by `at` whatever order they were written in, reads nothing while disabled, and
// follows new archive entries. Rendered with renderHook in jsdom; the database is the emulator.
import { describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import type { LogEntry } from '../../packages/shared/src/index.ts'
import * as data from '../../packages/web/src/data.ts'
import { T0, seedTask, useEmulator } from '../fixtures/web-threads-b4-emulator.ts'
import { doneTask, seedArchive } from '../fixtures/web-threads-b6-emulator.ts'

vi.mock('../../packages/web/src/firebase.ts', async () =>
  (await import('../fixtures/web-threads-b4-emulator.ts')).firebaseModule()
)
vi.mock('../../packages/web/src/lib/log.ts', async () =>
  (await import('../fixtures/web-threads-b4-emulator.ts')).logModule()
)

const e = (at: number, who: LogEntry['who'], text: string): LogEntry => ({ at, who, text })
// Written newest first, so the read has to order them.
const WRITTEN = [
  e(T0 + 3, 'system', 'Done'),
  e(T0 + 1, 'james', 'Queued: Ship the nav'),
  e(T0 + 2, 'session', 'Merged PR #7'),
]
const IN_ORDER = [WRITTEN[1], WRITTEN[2], WRITTEN[0]]

const entries = (list: readonly LogEntry[]) => list.map(({ at, who, text }) => ({ at, who, text }))

describe('B6-25 useLogArchive in the emulator', () => {
  useEmulator()

  it("returns the task's archived entries ordered by at", async () => {
    await seedTask(doneTask())
    await seedArchive('t1', WRITTEN)
    await seedArchive('t2', [e(T0, 'james', 'Another task')])
    const { result, unmount } = renderHook(() => data.useLogArchive('t1', true))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBeNull()
    expect(entries(result.current.data)).toEqual(IN_ORDER)
    expect(typeof result.current.retry).toBe('function')
    unmount()
  })

  it('reads nothing while disabled, and reads once enabled', async () => {
    await seedTask(doneTask())
    await seedArchive('t1', WRITTEN)
    const { result, rerender, unmount } = renderHook(
      ({ enabled }: { enabled: boolean }) => data.useLogArchive('t1', enabled),
      { initialProps: { enabled: false } }
    )
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.data).toEqual([])
    rerender({ enabled: true })
    await waitFor(() => expect(entries(result.current.data)).toEqual(IN_ORDER))
    unmount()
  })

  it('follows an entry archived after it started reading', async () => {
    await seedTask(doneTask())
    await seedArchive('t1', WRITTEN.slice(0, 2))
    const { result, unmount } = renderHook(() => data.useLogArchive('t1', true))
    await waitFor(() => expect(result.current.data).toHaveLength(2))
    await seedArchive('t1', [WRITTEN[2]])
    await waitFor(() => expect(entries(result.current.data)).toEqual(IN_ORDER))
    unmount()
  })
})
