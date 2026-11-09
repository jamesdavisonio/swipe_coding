import { useId } from 'react'
import type { Project } from '@kanban/shared'
import { Field } from './ui/field.tsx'
import { Select } from './ui/input.tsx'

// Which project a new task is for: the projects given, in the order given, each by its name.
export default function ProjectSelect({
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
