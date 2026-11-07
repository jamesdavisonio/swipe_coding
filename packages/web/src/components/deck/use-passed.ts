// What the deck remembers on this phone only (never synced): the cards James passed, in the order
// he passed them, and the suggested-next cards he started or dropped. Kept in localStorage; where
// storage is blocked (a private window, a full quota) the lists live in memory for this visit.
import { useCallback, useState } from 'react'
import { z } from 'zod'

const PASSED_KEY = 'kanban.deck.passed'
const HANDLED_KEY = 'kanban.deck.handled-next'
// Old ids fall off the front so the lists never grow without bound.
const MEMORY_CAP = 200

// localStorage is outside the code: anything but a list of strings reads as an empty list.
const Ids = z.array(z.string())

// The lists while storage cannot hold them.
const inMemory = new Map<string, string[]>()

function read(key: string): string[] {
  let raw: string | null
  try {
    raw = localStorage.getItem(key)
  } catch {
    return inMemory.get(key) ?? []
  }
  if (raw === null) return inMemory.get(key) ?? []
  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch {
    return []
  }
  const parsed = Ids.safeParse(value)
  return parsed.success ? parsed.data : []
}

function write(key: string, ids: string[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(ids))
    inMemory.delete(key)
  } catch {
    inMemory.set(key, ids)
  }
}

// `id` moved to the end (the latest), the oldest dropped past the cap.
const remember = (ids: readonly string[], id: string): string[] =>
  [...ids.filter((x) => x !== id), id].slice(-MEMORY_CAP)

function useRemembered(key: string) {
  const [ids, setIds] = useState(() => read(key))
  const add = useCallback(
    (id: string) => {
      const next = remember(read(key), id)
      write(key, next)
      setIds(next)
    },
    [key]
  )
  // Only the ids still in `keep`; writes nothing when all of them are.
  const keepOnly = useCallback(
    (keep: ReadonlySet<string>) => {
      const before = read(key)
      const next = before.filter((id) => keep.has(id))
      if (next.length === before.length) return
      write(key, next)
      setIds(next)
    },
    [key]
  )
  return { ids, add, keepOnly }
}

export function usePhoneMemory() {
  const passed = useRemembered(PASSED_KEY)
  const handled = useRemembered(HANDLED_KEY)
  return {
    passed: passed.ids,
    pass: passed.add,
    // A passed id names a card (`kind:taskId`); once that card has left the deck, a new card with
    // the same id (a new question on the same task) must start out unpassed. Call this only with
    // the cards of a loaded board, never the empty one before the first snapshot.
    forgetPassedExcept: passed.keepOnly,
    handledNext: handled.ids,
    handleNext: handled.add,
  }
}
