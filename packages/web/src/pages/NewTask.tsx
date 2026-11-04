import { useSearchParams } from 'react-router-dom'
import { useProjects } from '../data.ts'
import NewTaskForm from '../components/NewTaskForm.tsx'
import PageHeader from '../components/PageHeader.tsx'
import Screen from '../components/Screen.tsx'
import { EmptyNote, LoadFailed, LoadingStatus } from '../components/ScreenState.tsx'
import { NO_PROJECTS_TEXT } from '../lib/projects.ts'

const PROJECT_PARAM = 'project'

// /new — queue a task for the next session in a project. `?project=<id>` preselects the project
// (the + Task link on a project); otherwise the first one is selected. The form mounts once the
// projects have loaded, so its starting choice is already settled.
export default function NewTask() {
  const [params] = useSearchParams()
  const projects = useProjects()
  const wanted = params.get(PROJECT_PARAM)
  const first = projects.data[0]

  let body
  if (projects.error !== null)
    body = <LoadFailed title="Couldn't load projects" failed={[projects]} />
  else if (projects.loading) body = <LoadingStatus label="Loading projects" />
  else if (!first) body = <EmptyNote>{NO_PROJECTS_TEXT}</EmptyNote>
  else
    body = (
      <NewTaskForm
        projects={projects.data}
        initialProjectId={projects.data.find((p) => p.id === wanted)?.id ?? first.id}
      />
    )

  return <Screen header={<PageHeader title="New task" />}>{body}</Screen>
}
