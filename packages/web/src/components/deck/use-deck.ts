// Everything the deck shows, from the board's live data and what this phone remembers: the cards
// in order (minus the ones just acted on and the ones waiting for a revised card), the sessions
// working now, and the lookups the sheets need. The order itself is lib/deck.ts's; a `?task=<id>`
// (a tapped notification) puts that task's card first, a project tapped in the overview its cards.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { Task } from '@kanban/shared'
import { useAgents, useAllTasks, useOpenTodos, useProjects } from '../../data.ts'
import { buildDeck, projectFirst, taskFirst } from '../../lib/deck.ts'
import { activeNeed } from '../../lib/threads.ts'
import { useNow } from '../../lib/use-now.ts'
import { useGone } from './use-gone.ts'
import { usePhoneMemory } from './use-passed.ts'
import { useWaiting } from './use-waiting.ts'
import { workingSessions } from './working.ts'

// The latest spec brief text per task, as the SpecBodies loaders hand it up.
function useSpecBodies() {
  const [specBodies, setSpecBodies] = useState<Record<string, string>>({})
  const setSpecBody = useCallback((taskId: string, body: string | null) => {
    setSpecBodies((all) => {
      if ((all[taskId] ?? null) === body) return all
      const next = { ...all }
      if (body === null) delete next[taskId]
      else next[taskId] = body
      return next
    })
  }, [])
  return { specBodies, setSpecBody }
}

export function useDeck() {
  const now = useNow()
  const tasks = useAllTasks()
  const todos = useOpenTodos()
  const projects = useProjects()
  const agents = useAgents()
  const memory = usePhoneMemory()
  const waiting = useWaiting(tasks.data)
  const { specBodies, setSpecBody } = useSpecBodies()
  const [first, setFirst] = useState<string | null>(null)
  const openTask = useSearchParams()[0].get('task')

  const built = useMemo(
    () =>
      buildDeck({
        tasks: tasks.data,
        todos: todos.data,
        projects: projects.data,
        specBodies,
        handledNext: memory.handledNext,
        passed: memory.passed,
        now,
      }),
    [tasks.data, todos.data, projects.data, specBodies, memory.handledNext, memory.passed, now]
  )

  // Passes of cards that have left the deck are forgotten, but only from a loaded board: the empty
  // list before the first snapshot (or after a failed read) would wipe every pass.
  const loaded = [tasks, todos, projects].every((s) => !s.loading && s.error === null)
  const { forgetPassedExcept } = memory
  useEffect(() => {
    if (loaded) forgetPassedExcept(new Set(built.map((c) => c.id)))
  }, [loaded, built, forgetPassedExcept])

  const { gone, hide, unhide } = useGone(built)
  const held = new Set(waiting.waiting.map((w) => w.taskId))
  const shown = built.filter((c) => !gone.has(c.id) && !(c.taskId !== null && held.has(c.taskId)))
  const taskOrdered = openTask ? taskFirst(shown, openTask) : shown
  const cards = first ? projectFirst(taskOrdered, first) : taskOrdered

  const nameOf = useMemo(() => new Map(projects.data.map((p) => [p.id, p.name])), [projects.data])
  const taskOf = (id: string | null): Task | null =>
    id ? (tasks.data.find((t) => t.id === id) ?? null) : null
  const remoteUrlOf = (task: Task | null): string | null =>
    agents.data.find((a) => a.id === task?.agentId)?.remoteUrl ?? null

  return {
    now,
    cards,
    todos: todos.data,
    specTasks: tasks.data.filter((t) => activeNeed(t)?.kind === 'spec'),
    working: workingSessions({ tasks: tasks.data, agents: agents.data, nameOf, now }),
    memory,
    waiting,
    setSpecBody,
    taskOf,
    remoteUrlOf,
    putFirst: setFirst,
    hide,
    unhide,
  }
}

export type DeckModel = ReturnType<typeof useDeck>
