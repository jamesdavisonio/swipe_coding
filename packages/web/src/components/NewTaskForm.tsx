import { useId, useState, type FormEvent, type ReactNode } from 'react'
import { TASK_TYPE_LABELS, type Project } from '@kanban/shared'
import { MAX_DESCRIPTION_CHARS, MAX_TITLE_CHARS } from '../lib/limits.ts'
import { QUEUEABLE_TYPES, parseSteps, stagePreview, type QueueableType } from '../lib/new-task.ts'
import { useQueueTask } from '../lib/use-queue-task.ts'
import SaveError from './SaveError.tsx'
import { Button } from './ui/button.tsx'
import { Input, Select, Textarea } from './ui/input.tsx'
import { Label } from './ui/label.tsx'
import { Segmented } from './ui/segmented.tsx'

const TYPE_OPTIONS = QUEUEABLE_TYPES.map((id) => ({ id, label: TASK_TYPE_LABELS[id] }))

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string
  htmlFor?: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  )
}

// The New task form: which project, what kind of task, a title (required), a description for the
// session and, optionally, steps James will do himself after deploy. The preview shows the stage
// list the task will get. Queue task saves once and returns to Threads.
export default function NewTaskForm({
  projects,
  initialProjectId,
}: {
  projects: readonly Pick<Project, 'id' | 'name'>[]
  initialProjectId: string
}) {
  const ids = { project: useId(), title: useId(), description: useId(), steps: useId() }
  const [projectId, setProjectId] = useState(initialProjectId)
  const [type, setType] = useState<QueueableType>('feature')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [hasSteps, setHasSteps] = useState(false)
  const [stepsText, setStepsText] = useState('')
  const { pending, failed, queue } = useQueueTask()

  const steps = hasSteps ? parseSteps(stepsText) : []
  const canSave = title.trim() !== '' && !pending

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!canSave) return
    void queue(projectId, {
      type,
      title: title.trim(),
      description: description.trim(),
      afterDeploy: steps,
    })
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 px-4">
      <Field label="Project" htmlFor={ids.project}>
        <Select id={ids.project} value={projectId} onChange={(e) => setProjectId(e.target.value)}>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Type">
        <Segmented label="Type" options={TYPE_OPTIONS} value={type} onChange={setType} />
      </Field>
      <Field label="Title" htmlFor={ids.title}>
        <Input
          id={ids.title}
          required
          maxLength={MAX_TITLE_CHARS}
          placeholder="What should ship?"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </Field>
      <Field label="Description for the session" htmlFor={ids.description}>
        <Textarea
          id={ids.description}
          rows={4}
          maxLength={MAX_DESCRIPTION_CHARS}
          placeholder="Enough for the session to write the spec. It will ask before building."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </Field>
      <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4 shadow-sm">
        <label className="flex min-h-11 cursor-pointer items-center gap-3 font-bold">
          <input
            type="checkbox"
            className="size-7 shrink-0 accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            checked={hasSteps}
            onChange={(e) => setHasSteps(e.target.checked)}
          />
          I have steps to do after deploy
        </label>
        {hasSteps ? (
          <Field label="One per line" htmlFor={ids.steps}>
            <Textarea
              id={ids.steps}
              rows={3}
              placeholder={'Flip the feature flag\nTell the team'}
              value={stepsText}
              onChange={(e) => setStepsText(e.target.value)}
            />
          </Field>
        ) : null}
        <p className="text-sm text-muted-foreground">{stagePreview(type, steps)}</p>
      </div>
      <SaveError failed={failed} />
      <Button type="submit" block disabled={!canSave}>
        Queue task
      </Button>
      <p className="text-sm text-muted-foreground">
        A session in that folder picks it up; you hear from it when the spec is ready.
      </p>
    </form>
  )
}
