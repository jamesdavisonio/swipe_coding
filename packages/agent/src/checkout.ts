// The folder whose project an agent belongs to. A session started with `claude -w` runs in a
// linked git worktree (<repo>\.claude\worktrees\<name>); its work belongs to the repository's
// project, so the project folder is the worktree's main checkout. Any other folder (a main
// checkout, a folder outside git) is its own project folder.
import { execFileSync } from 'node:child_process'
import { basename, dirname, isAbsolute, resolve } from 'node:path'
import { z } from 'zod'
import { log } from './firestore.ts'

const GIT_TIMEOUT_MS = 5_000

// What execFileSync throws: an Error, with git's stderr when git ran (none when it is missing).
const GitFailure = z.object({ message: z.string(), stderr: z.string().optional() })

// git rev-parse's answer: exactly two absolute paths. An older git without --path-format
// echoes the option back instead, which this refuses.
const AbsolutePath = z.string().refine((p) => isAbsolute(p))
const GitDirs = z
  .string()
  .transform((out) => out.split(/\r?\n/).filter((line) => line.trim() !== ''))
  .pipe(z.tuple([AbsolutePath, AbsolutePath]))

// `cwd` itself, or the main checkout when `cwd` is inside a linked worktree. Git missing, failing
// or answering in an unexpected shape never stops the agent: it falls back to `cwd` with one log
// line. A folder outside any repository is not a failure, so it falls back silently.
export function projectFolderFor(cwd: string): string {
  let out: string
  try {
    out = execFileSync(
      'git',
      ['rev-parse', '--path-format=absolute', '--git-dir', '--git-common-dir'],
      {
        cwd,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: GIT_TIMEOUT_MS,
        windowsHide: true,
      }
    )
  } catch (err) {
    const failure = GitFailure.safeParse(err)
    const stderr = failure.success ? (failure.data.stderr ?? '') : ''
    if (!/not a git repository/i.test(stderr)) {
      const why = failure.success ? failure.data.message.split('\n')[0] : 'unknown error'
      log(`project folder: git failed in ${cwd} (${why}); using it`)
    }
    return cwd
  }
  const dirs = GitDirs.safeParse(out)
  if (!dirs.success) {
    log(`project folder: unexpected git answer in ${cwd}; using it`)
    return cwd
  }
  // Git answers with forward slashes; resolve() gives the platform's native form.
  const gitDir = resolve(dirs.data[0])
  const common = resolve(dirs.data[1])
  if (gitDir === common) return cwd // a main checkout (or a folder inside one)
  if (basename(common) !== '.git') {
    log(`project folder: worktree ${cwd} has no main checkout (git dir ${common}); using it`)
    return cwd
  }
  return dirname(common)
}
