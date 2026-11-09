// @vitest-environment jsdom
// Reproduction for the stale waiting line (2026-11-09, James's screenshot): after a voice note
// the deck shows "Waiting for <session>'s revised card…" until the session posts a new card.
// The revised card arrived and James approved it; the approval cleared the task's need, and the
// line came back for the rest of its 10 minutes, as if the deck were still waiting.
//
// Expected: once the revised card has arrived, the wait is over for good, whatever James then
// does with that card. Before it arrives, the line stays, and it still ends after 10 minutes.
import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Task, TaskNeed } from '../packages/shared/src/index.ts'
import { REVISED_WAIT_MS, useWaiting } from '../packages/web/src/components/deck/use-waiting.ts'

const NOTE_AT = 1_000
const task = (updatedAt: number, needs: TaskNeed | null) =>
  ({ id: 't1', needs, updatedAt }) as unknown as Task

function waitingAfterNote() {
  const view = renderHook(({ tasks }: { tasks: Task[] }) => useWaiting(tasks), {
    initialProps: { tasks: [task(NOTE_AT, null)] },
  })
  act(() => view.result.current.add('t1', 'Kanban', NOTE_AT))
  return view
}

afterEach(() => vi.useRealTimers())

describe('fix: the waiting line ends once the revised card arrives', () => {
  it('shows the line while the session has not answered', () => {
    const view = waitingAfterNote()
    expect(view.result.current.waiting.map((w) => w.taskId)).toEqual(['t1'])
  })

  it('hides it when the revised card arrives', () => {
    const view = waitingAfterNote()
    view.rerender({ tasks: [task(NOTE_AT + 10, { kind: 'spec' })] })
    expect(view.result.current.waiting).toEqual([])
  })

  it('does not bring it back when James then answers the revised card', () => {
    const view = waitingAfterNote()
    view.rerender({ tasks: [task(NOTE_AT + 10, { kind: 'spec' })] })
    view.rerender({ tasks: [task(NOTE_AT + 20, null)] })
    expect(view.result.current.waiting).toEqual([])
  })

  it('still ends after 10 minutes when the session never answers', () => {
    vi.useFakeTimers()
    const view = waitingAfterNote()
    act(() => vi.advanceTimersByTime(REVISED_WAIT_MS + 1))
    expect(view.result.current.waiting).toEqual([])
  })
})
