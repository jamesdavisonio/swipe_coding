// The New session sheet: a project (the board's, by name), a type, a name and the idea (typed or
// dictated with the deck's microphone). Start session writes one task that asks the PC to start a
// session for it; the sheet then closes and the deck says so (docs/features/launch-session.md).
import { useId, type FormEvent } from 'react'
import type { Project } from '@kanban/shared'
import { cn } from '../../lib/cn.ts'
import { Mic, Square } from '../../lib/icons.ts'
import { MAX_DESCRIPTION_CHARS, MAX_TITLE_CHARS } from '../../lib/limits.ts'
import type { QueueableType } from '../../lib/new-task.ts'
import { recognizerClass } from '../../lib/speech.ts'
import { sessionProjects, useNewSession, type NewSessionModel } from '../../lib/use-new-session.ts'
import SaveError from '../SaveError.tsx'
import { Button } from '../ui/button.tsx'
import { Field } from '../ui/field.tsx'
import { Input, Select, Textarea } from '../ui/input.tsx'
import DeckSheet from './DeckSheet.tsx'

const TYPES: readonly { id: QueueableType; label: string }[] = [
  { id: 'feature', label: 'Feature' },
  { id: 'bugfix', label: 'Bugfix' },
  { id: 'chore', label: 'Chore' },
]
const REFUSED = "Couldn't start it. Try again."

// Feature, Bugfix or Chore: native radios, drawn as the segmented control.
function TypeChoice({
  value,
  onChange,
}: {
  value: QueueableType
  onChange: (type: QueueableType) => void
}) {
  const name = useId()
  return (
    <Field label="Type">
      <div role="radiogroup" aria-label="Type" className="flex gap-1 rounded-md bg-muted p-1">
        {TYPES.map((t) => (
          <label
            key={t.id}
            className={cn(
              'grid h-11 min-w-0 flex-1 cursor-pointer place-items-center rounded-sm px-2 text-sm font-bold',
              'has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring',
              t.id === value ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
            )}
          >
            <input
              type="radio"
              name={name}
              value={t.id}
              checked={t.id === value}
              onChange={() => onChange(t.id)}
              className="sr-only"
            />
            {t.label}
          </label>
        ))}
      </div>
    </Field>
  )
}

// The idea box with the microphone beside its label: Dictate, or Stop dictating while it listens.
function IdeaField({ idea }: { idea: NewSessionModel['idea'] }) {
  const id = useId()
  const canDictate = recognizerClass() !== null && !idea.refused
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-end justify-between gap-3">
        <label htmlFor={id} className="text-sm font-semibold text-foreground">
          The idea
        </label>
        {canDictate ? (
          <button
            type="button"
            aria-label={idea.listening ? 'Stop dictating' : 'Dictate'}
            onClick={idea.listening ? idea.stop : idea.dictate}
            className={cn(
              'grid size-11 shrink-0 place-items-center rounded-full border border-border',
              idea.listening && 'border-rec text-rec'
            )}
          >
            {idea.listening ? (
              <Square aria-hidden="true" className="size-4" />
            ) : (
              <Mic aria-hidden="true" className="size-5" />
            )}
          </button>
        ) : null}
      </div>
      <Textarea
        id={id}
        rows={4}
        maxLength={MAX_DESCRIPTION_CHARS}
        placeholder="What should the session do? It writes the spec first."
        value={idea.idea}
        onChange={(event) => idea.type(event.target.value)}
      />
    </div>
  )
}

export default function NewSessionSheet({
  projects,
  initialProjectId,
  onStarted,
  onClose,
  returnFocus,
}: {
  projects: readonly Project[]
  initialProjectId: string
  onStarted: (name: string) => void
  onClose: () => void
  returnFocus: () => void
}) {
  const form = useNewSession(initialProjectId, onStarted)
  const { values, set } = form
  const ids = { project: useId(), name: useId() }

  function submit(event: FormEvent) {
    event.preventDefault()
    void form.start()
  }

  return (
    <DeckSheet title="New session" onClose={onClose} returnFocus={returnFocus}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label="Project" htmlFor={ids.project}>
          <Select
            id={ids.project}
            value={values.projectId}
            onChange={(event) => set.projectId(event.target.value)}
          >
            {sessionProjects(projects).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
        <TypeChoice value={values.type} onChange={set.type} />
        <Field label="Name" htmlFor={ids.name}>
          <Input
            id={ids.name}
            required
            maxLength={MAX_TITLE_CHARS}
            placeholder="What the session and its task are called"
            value={values.name}
            onChange={(event) => set.name(event.target.value)}
          />
        </Field>
        <IdeaField idea={form.idea} />
        <SaveError failed={form.failed} message={REFUSED} />
        <Button type="submit" block disabled={!form.canStart}>
          Start session
        </Button>
      </form>
    </DeckSheet>
  )
}
