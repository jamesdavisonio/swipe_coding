// The New session sheet's state (docs/features/launch-session.md): which project, what kind of
// task, its name and the idea, and the save, which writes one task with `launch: true` so the
// notifier on the PC starts a session for it. The idea box takes typing and dictation: each
// dictation appends to the text as it was when James tapped Dictate.
import { useState } from 'react'
import type { Project } from '@kanban/shared'
import { useRecognition } from '../components/deck/use-recognition.ts'
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

// Dictated words follow the text before them after one space.
const appendWords = (before: string, words: string) =>
  [before.trimEnd(), words].filter((s) => s !== '').join(' ')

// The idea box: what James typed, and what he dictates after it. Typing takes the box over (and
// ends a dictation that is still listening).
function useIdea() {
  const voice = useRecognition()
  const [typed, setTyped] = useState('')
  // The text before the current dictation; null once James types.
  const [before, setBefore] = useState<string | null>(null)
  const idea = before === null ? typed : appendWords(before, voice.text)

  function type(text: string) {
    if (voice.listening) voice.stop()
    setTyped(text)
    setBefore(null)
  }
  function dictate() {
    setBefore(idea)
    voice.reset()
    voice.start()
  }

  return {
    idea,
    type,
    dictate,
    stop: voice.stop,
    listening: voice.listening,
    refused: voice.refused,
  }
}

export function useNewSession(
  initialProjectId: string,
  onStarted: (name: string, taskId: string) => void
) {
  const [projectId, setProjectId] = useState(initialProjectId)
  const [type, setType] = useState<QueueableType>('feature')
  const [name, setName] = useState('')
  const idea = useIdea()
  const { pending, failed, save } = useTaskSave(LAUNCH_FEATURE, START_SESSION)
  const canStart = name.trim() !== '' && projectId !== '' && !pending

  async function start() {
    if (!canStart) return
    if (idea.listening) idea.stop()
    const title = name.trim()
    const saved = await save(projectId, {
      type,
      title,
      description: idea.idea.trim(),
      afterDeploy: [],
      launch: true,
    })
    if (saved) onStarted(title, saved.id)
  }

  return {
    values: { projectId, type, name },
    set: { projectId: setProjectId, type: setType, name: setName },
    idea,
    canStart,
    failed,
    start,
  }
}

export type NewSessionModel = ReturnType<typeof useNewSession>
