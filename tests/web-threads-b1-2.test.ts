// web-threads B1, criterion 2: done tasks leave the lists more than 7 days after finishing.
// "Opened by id" is a UI path that does not consult isTaskVisible, so it is not tested here.
import { describe, expect, it } from 'vitest'
import { DONE_VISIBLE_MS, isDone, isTaskVisible } from '../packages/shared/src/index.ts'

const NOW = 1_800_000_000_000
const DAY = 24 * 60 * 60 * 1000

describe('B1-2 done-task visibility', () => {
  it('the window is 7 days', () => {
    expect(DONE_VISIBLE_MS).toBe(7 * DAY)
  })

  it('only the done stage counts as done', () => {
    expect(isDone({ stage: 'done' })).toBe(true)
    expect(isDone({ stage: 'main_ci' })).toBe(false)
  })

  it('a done task finished more than 7 days ago is excluded with show older off', () => {
    const old = { stage: 'done' as const, doneAt: NOW - 7 * DAY - 1 }
    expect(isTaskVisible(old, { now: NOW })).toBe(false)
    expect(isTaskVisible(old, { now: NOW, showOlder: false })).toBe(false)
  })

  it('show older on brings it back', () => {
    expect(
      isTaskVisible({ stage: 'done', doneAt: NOW - 30 * DAY }, { now: NOW, showOlder: true })
    ).toBe(true)
  })

  it('doneAt exactly 7 days ago is still visible', () => {
    expect(isTaskVisible({ stage: 'done', doneAt: NOW - 7 * DAY }, { now: NOW })).toBe(true)
  })

  it('a not-done task is visible whatever its doneAt; a done task without doneAt is visible', () => {
    expect(isTaskVisible({ stage: 'build', doneAt: NOW - 90 * DAY }, { now: NOW })).toBe(true)
    expect(isTaskVisible({ stage: 'spec', doneAt: null }, { now: NOW })).toBe(true)
    expect(isTaskVisible({ stage: 'done', doneAt: null }, { now: NOW })).toBe(true)
  })

  it('defaults to the current time when now is not given', () => {
    expect(isTaskVisible({ stage: 'done', doneAt: Date.now() - 8 * DAY })).toBe(false)
    expect(isTaskVisible({ stage: 'done', doneAt: Date.now() - DAY })).toBe(true)
  })

  it('filtering a list keeps everything except done tasks older than 7 days', () => {
    const tasks = [
      { id: 'live', stage: 'build' as const, doneAt: null },
      { id: 'recent', stage: 'done' as const, doneAt: NOW - 2 * DAY },
      { id: 'old', stage: 'done' as const, doneAt: NOW - 8 * DAY },
    ]
    expect(tasks.filter((t) => isTaskVisible(t, { now: NOW })).map((t) => t.id)).toEqual([
      'live',
      'recent',
    ])
    expect(
      tasks.filter((t) => isTaskVisible(t, { now: NOW, showOlder: true })).map((t) => t.id)
    ).toEqual(['live', 'recent', 'old'])
  })
})
