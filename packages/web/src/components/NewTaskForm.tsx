import { useId } from 'react'
import { TASK_TYPE_LABELS, type Project } from '@kanban/shared'
import { MAX_DESCRIPTION_CHARS, MAX_TITLE_CHARS } from '../lib/limits.ts'
import { QUEUEABLE_TYPES, stagePreview } from '../lib/new-task.ts'
import { useNewTaskForm } from '../lib/use-new-task-form.ts'
import AfterDeployFields from './AfterDeployFields.tsx'
import SaveError from './SaveError.tsx'
import { Button } from './ui/button.tsx'
import { Field } from './ui/field.tsx'
import { Input, Select, Textarea } from './ui/input.tsx'
import { Segmented } from './ui/segmented.tsx'

const TYPE_OPTIONS = QUEUEABLE_TYPES.map((id) => ({ id, label: TASK_TYPE_LABELS[id] }))

// Which project the task is for.
function ProjectSelect({
  projects,
  value,
  onChange,
}: {
  projects: readonly Pick<Project, 'id' | 'name'>[]
  value: string
  onChange: (projectId: string) => void
}) {
  const id = useId()
  return (
    <Field label="Project" htmlFor={id}>
      <Select id={id} value={value} onChange={(event) => onChange(event.target.value)}>
        {projects.map((project) => (
          <option key={project.id} value={project.id}>
            {project.name}
          </option>
        ))}
      </Select>
    </Field>
  )
}

// The title (required) and the description the session reads before it writes the spec.
function TitleAndDescription({
  title,
  onTitle,
  description,
  onDescription,
}: {
  title: string
  onTitle: (title: string) => void
  description: string
  onDescription: (description: string) => void
}) {
  const ids = { title: useId(), description: useId() }
  return (
    <>
      <Field label="Title" htmlFor={ids.title}>
        <Input
          id={ids.title}
          required
          maxLength={MAX_TITLE_CHARS}
          placeholder="What should ship?"
          value={title}
          onChange={(event) => onTitle(event.target.value)}
        />
      </Field>
      <Field label="Description for the session" htmlFor={ids.description}>
        <Textarea
          id={ids.description}
          rows={4}
          maxLength={MAX_DESCRIPTION_CHARS}
          placeholder="Enough for the session to write the spec. It will ask before building."
          value={description}
          onChange={(event) => onDescription(event.target.value)}
        />
      </Field>
    </>
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
  const form = useNewTaskForm(initialProjectId)
  const { values, set } = form

  return (
    <form onSubmit={form.submit} className="flex flex-col gap-4 px-4">
      <ProjectSelect projects={projects} value={values.projectId} onChange={set.projectId} />
      <Field label="Type">
        <Segmented label="Type" options={TYPE_OPTIONS} value={values.type} onChange={set.type} />
      </Field>
      <TitleAndDescription
        title={values.title}
        onTitle={set.title}
        description={values.description}
        onDescription={set.description}
      />
      <AfterDeployFields
        checked={values.hasSteps}
        onChecked={form.setHasSteps}
        text={values.stepsText}
        onText={form.setStepsText}
        preview={stagePreview(values.type, form.steps)}
      />
      <SaveError failed={form.failed} />
      <Button type="submit" block disabled={!form.canSave}>
        Queue task
      </Button>
      <p className="text-sm text-muted-foreground">
        A session in that folder picks it up; you hear from it when the spec is ready.
      </p>
    </form>
  )
}
