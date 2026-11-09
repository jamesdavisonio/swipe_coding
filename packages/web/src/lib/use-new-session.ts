// The New session sheet's state (docs/features/launch-session.md): which project, what kind of
// task and its name, and the save, which writes one task with `launch: true` so the notifier on
// the PC starts a session for it. The idea (typed or dictated) is the sheet's; start() takes it.
import { useState } from 'react'
import type { Project } from '@kanban/shared'
import type { QueueableType } from './new-task.ts'
import { useTaskSave } from './use-queue-task.ts'

export const LAUNCH_FEATURE = 'launch-session'
const START_SESSION = 'start_session'

type NamedProject = Pick<Project, 'id' | 'name' | 'updatedAt'>

// The board's projects for the sheet's list: each once, by its name, alphabetically.
export function sessionProjects<P extends NamedProject>(projects: readonly P[]): P[] {
  const byId = new Map(projects.map((p) => [p.id, p]))
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name))
}

// The project preselected: the one of the card on screen, else the most recently updated one.
export function defaultProjectId(
  projects: readonly NamedProject[],
  onScreen: string | null
): string {
  if (onScreen !== null && projects.some((p) => p.id === onScreen)) return onScreen
  const newest = projects.reduce<NamedProject | null>(
    (best, p) => (best === null || p.updatedAt > best.updatedAt ? p : best),
    null
  )
  return newest?.id ?? ''
}

export function useNewSession(
  initialProjectId: string,
  onStarted: (name: string, taskId: string) => void
) {
  const [projectId, setProjectId] = useState(initialProjectId)
  const [type, setType] = useState<QueueableType>('feature')
  const [name, setName] = useState('')
  const { pending, failed, save } = useTaskSave(LAUNCH_FEATURE, START_SESSION)
  const canStart = name.trim() !== '' && projectId !== '' && !pending

  // Writes the task once (a tap while the save is pending writes nothing); a refused save keeps
  // everything as it was and sets `failed`.
  async function start(idea: string) {
    if (!canStart) return
    const title = name.trim()
    const saved = await save(projectId, {
      type,
      title,
      description: idea.trim(),
      afterDeploy: [],
      launch: true,
    })
    if (saved) onStarted(title, saved.id)
  }

  return {
    values: { projectId, type, name },
    set: { projectId: setProjectId, type: setType, name: setName },
    canStart,
    failed,
    start,
  }
}
