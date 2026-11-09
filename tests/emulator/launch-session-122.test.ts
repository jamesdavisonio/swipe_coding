// launch-session 122 in the Firestore emulator (`npm run test:rules`): the request the notifier
// hands to Claude Code: the project's folder, a name equal to the task's title, a worktree
// `launch-<task id>` when the folder is a git repository (else none), and a first message that
// holds the task id, `kanban_start_task`, the task's title and its description, verbatim.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import {
  adminDb,
  callsFor,
  clearLaunchData,
  fakeLaunch,
  folder,
  push,
  putLaunchTask,
  putProject,
  requested,
  startWith,
  stopAll,
  waitForState,
  type Db,
} from '../fixtures/launch-session-emulator.ts'

let db: Db
const launch = fakeLaunch()

beforeAll(async () => {
  db = await adminDb()
})
beforeEach(async () => {
  await stopAll()
  await clearLaunchData(db)
  launch.reset()
  push.reset()
})
afterAll(async () => {
  await stopAll()
  await clearLaunchData(db)
})

async function launched(cwd: string, over: Record<string, unknown> = {}) {
  const task = await putLaunchTask(db, await putProject(db, { cwd }), requested(), over)
  await startWith(db, launch)
  await waitForState(db, task.id, 'started')
  const [req] = callsFor(launch, task.id)
  return { task, req }
}

describe('launch-session 122: what Claude Code is asked to do', () => {
  it('a git repository gets a new worktree named launch-<task id>', async () => {
    const cwd = folder('git')
    const { task, req } = await launched(cwd, { title: 'Add the search page' })
    expect(req.cwd).toBe(cwd)
    expect(req.name).toBe('Add the search page')
    expect(req.worktree).toBe(`launch-${task.id}`)
  })

  it('a plain folder is used itself: no worktree', async () => {
    const cwd = folder('plain')
    const { req } = await launched(cwd, { title: 'Tidy the notes' })
    expect(req.cwd).toBe(cwd)
    expect(req.worktree).toBeNull()
  })

  it('the first message names the task id, kanban_start_task, the title and the description', async () => {
    const { task, req } = await launched(folder('git'), {
      title: 'Add the search page',
      description: 'Search by title and by project.\nKeep it fast.',
    })
    expect(req.prompt).toContain(task.id)
    expect(req.prompt).toContain('kanban_start_task')
    expect(req.prompt).toContain('Add the search page')
    expect(req.prompt).toContain('Search by title and by project.\nKeep it fast.')
  })

  it('a title and description full of shell characters arrive unchanged, as data', async () => {
    const title = '"; rm -rf ~ & echo'
    const description = '$(whoami) `id` | cat > /etc/x ; && \'quote\' "double" %PATH% \\ \n--bg'
    const { task, req } = await launched(folder('git'), { title, description })
    expect(req.name).toBe(title)
    expect(req.prompt).toContain(title)
    expect(req.prompt).toContain(description)
    expect(req.worktree).toBe(`launch-${task.id}`)
    expect(req.worktree).not.toMatch(/[^A-Za-z0-9_.-]/)
  })
})
