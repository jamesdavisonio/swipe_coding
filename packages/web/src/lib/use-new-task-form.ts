// The New task form's state: what James has entered so far, the steps it yields and the save.
import { useState, type FormEvent } from 'react'
import { parseSteps, type QueueableType } from './new-task.ts'
import { useQueueTask } from './use-queue-task.ts'

export function useNewTaskForm(initialProjectId: string) {
  const [projectId, setProjectId] = useState(initialProjectId)
  const [type, setType] = useState<QueueableType>('feature')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [hasSteps, setHasSteps] = useState(false)
  const [stepsText, setStepsText] = useState('')
  const { pending, failed, queue } = useQueueTask()

  // The steps as they would be saved: none unless the box is ticked.
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

  return {
    values: { projectId, type, title, description, hasSteps, stepsText },
    set: { projectId: setProjectId, type: setType, title: setTitle, description: setDescription },
    setHasSteps,
    setStepsText,
    steps,
    canSave,
    failed,
    submit,
  }
}
