// Reproduction for the first New session launch (2026-11-09): a session started with
// `claude -w` runs in a git worktree (<repo>\.claude\worktrees\launch-<id>), and its agent
// registered that folder as a project of its own ("launch-gwvzbnj7…"), so kanban_start_task
// refused the task James had queued for the repository: "belongs to another project".
//
// Expected: an agent whose folder is a linked git worktree belongs to the project of the
// worktree's main checkout (same projectId, and the project document names the main folder);
// its own agent document keeps the folder it really runs in. A main checkout, and a folder
// that is not a git repository, keep their own project as before.
import { execFileSync } from 'node:child_process'
import { mkdtempSync, realpathSync } from 'node:fs'
import { hostname, tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { projectIdFor } from '../../packages/shared/src/index.ts'
import { Board } from '../../packages/agent/src/board.ts'

const boards: Board[] = []
afterEach(async () => {
  await Promise.all(boards.splice(0).map((b) => b.shutdown()))
})

const git = (cwd: string, ...args: string[]) =>
  execFileSync('git', args, { cwd, stdio: 'pipe' }).toString().trim()

// A repository with one commit, and a linked worktree of it under .claude\worktrees.
function repoWithWorktree() {
  const main = realpathSync.native(mkdtempSync(join(tmpdir(), 'wtfix-')))
  git(main, 'init', '-q')
  git(main, '-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '--allow-empty', '-m', 'i')
  const worktree = join(main, '.claude', 'worktrees', 'launch-abc123')
  git(main, 'worktree', 'add', '-q', worktree, '-b', 'worktree-launch-abc123')
  return { main, worktree }
}

async function register(cwd: string) {
  const board = new Board(cwd)
  boards.push(board)
  await board.register()
  const agent = (await board.db.collection('agents').doc(board.id.agentId).get()).data()
  const project = (await board.db.collection('projects').doc(board.id.projectId).get()).data()
  return { board, agent, project }
}

describe('fix: an agent in a git worktree belongs to its main checkout', () => {
  it('a worktree agent joins the main folder project; its agent keeps the worktree folder', async () => {
    const { main, worktree } = repoWithWorktree()
    const { board, agent, project } = await register(worktree)

    expect(board.id.projectId).toBe(projectIdFor(hostname(), main))
    expect(agent?.projectId).toBe(projectIdFor(hostname(), main))
    expect(agent?.cwd).toBe(worktree)
    expect(project?.cwd).toBe(main)
    expect(project?.name).toBe(main.split(/[\\/]/).pop())
  })

  it('the main checkout and its worktree share one project', async () => {
    const { main, worktree } = repoWithWorktree()
    const a = await register(main)
    const b = await register(worktree)
    expect(b.board.id.projectId).toBe(a.board.id.projectId)
  })

  it('a main checkout and a plain folder keep their own project, as before', async () => {
    const { main } = repoWithWorktree()
    const plain = realpathSync.native(mkdtempSync(join(tmpdir(), 'wtfix-plain-')))
    const m = await register(main)
    const p = await register(plain)
    expect(m.board.id.projectId).toBe(projectIdFor(hostname(), main))
    expect(m.project?.cwd).toBe(main)
    expect(p.board.id.projectId).toBe(projectIdFor(hostname(), plain))
    expect(p.project?.cwd).toBe(plain)
  })
})
