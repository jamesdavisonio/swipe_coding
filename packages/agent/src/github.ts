// Reading a pull request's checks from GitHub (docs/features/pr-ready.md). The notifier's PR
// watcher (pr-watcher.ts) asks a GithubPort for a PR's state; the real one runs GitHub's own CLI,
// `gh pr view <url> --json state,mergeable,headRefOid,statusCheckRollup`, already signed in on
// James's PC, with an argument array and no shell, so nothing in a PR url can run a command.
// Against the Firestore emulator the default port never runs `gh` (as fcmPush() sends nothing).
import { spawn } from 'node:child_process'
import { z } from 'zod'
import { CodedError, lastLine } from './process-output.ts'

export interface PrCheck {
  name: string
  status: 'COMPLETED' | 'PENDING'
  conclusion: string
}

export interface PrStatus {
  state: 'OPEN' | 'MERGED' | 'CLOSED'
  mergeable: 'MERGEABLE' | 'CONFLICTING' | 'UNKNOWN'
  head: string
  checks: PrCheck[]
}

export interface GithubPort {
  prStatus(url: string): Promise<PrStatus>
}

// The fields asked of `gh pr view`.
export const GH_FIELDS = 'state,mergeable,headRefOid,statusCheckRollup'
// A read that has printed nothing by then is given up (and the process stopped).
export const GH_TIMEOUT_MS = 60_000

// What every PR reads as under the emulator: open, mergeability unknown, so it stays pending.
const EMULATOR_STATUS: PrStatus = { state: 'OPEN', mergeable: 'UNKNOWN', head: '', checks: [] }

// ---- gh's answer, read defensively -------------------------------------------------------------

// A check run (GitHub Actions and other apps) and a commit status (older CI integrations).
const CheckRun = z.object({
  __typename: z.literal('CheckRun'),
  name: z.string(),
  status: z.string(),
  conclusion: z.string().nullish(),
})
const StatusContext = z.object({
  __typename: z.literal('StatusContext'),
  context: z.string(),
  state: z.string(),
})
const GhAnswer = z.object({
  state: z.enum(['OPEN', 'MERGED', 'CLOSED']),
  mergeable: z.enum(['MERGEABLE', 'CONFLICTING', 'UNKNOWN']),
  headRefOid: z.string(),
  statusCheckRollup: z.array(z.discriminatedUnion('__typename', [CheckRun, StatusContext])),
})
type RollupItem = z.infer<typeof GhAnswer>['statusCheckRollup'][number]

// A commit status still waiting on its CI.
const PENDING_STATES: readonly string[] = ['PENDING', 'EXPECTED']

function toCheck(item: RollupItem): PrCheck {
  if (item.__typename === 'CheckRun')
    return {
      name: item.name,
      status: item.status === 'COMPLETED' ? 'COMPLETED' : 'PENDING',
      conclusion: item.conclusion ?? '',
    }
  return {
    name: item.context,
    status: PENDING_STATES.includes(item.state) ? 'PENDING' : 'COMPLETED',
    conclusion: item.state,
  }
}

class GithubError extends CodedError {}

// gh's JSON as a PrStatus; anything unexpected rejects (code bad_output) rather than guessing.
function parseAnswer(stdout: string): PrStatus {
  let json: unknown
  try {
    json = JSON.parse(stdout)
  } catch (err) {
    throw new GithubError(`gh printed no JSON: ${(err as Error).message}`, 'bad_output')
  }
  const parsed = GhAnswer.safeParse(json)
  if (!parsed.success)
    throw new GithubError(`gh answered an unexpected shape: ${parsed.error.message}`, 'bad_output')
  const a = parsed.data
  return {
    state: a.state,
    mergeable: a.mergeable,
    head: a.headRefOid,
    checks: a.statusCheckRollup.map(toCheck),
  }
}

// Runs `command` with `args`, never through a shell, and resolves with what it printed when it
// exits 0. A spawn failure rejects with its own error (code ENOENT for a missing executable); a
// non-zero exit with code exit_<n> and the last line it printed on stderr.
function runGh(command: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { shell: false, windowsHide: true, stdio: 'pipe' })
    child.stdin.end()
    let stdout = ''
    let stderr = ''
    let settled = false
    const settle = (finish: () => void) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      finish()
    }
    const timer = setTimeout(() => {
      settle(() => reject(new GithubError('gh did not answer in time', 'timeout')))
      child.kill()
    }, GH_TIMEOUT_MS)
    child.stdout.setEncoding('utf8').on('data', (chunk: string) => (stdout += chunk))
    child.stderr.setEncoding('utf8').on('data', (chunk: string) => (stderr += chunk))
    child.on('error', (err) => settle(() => reject(err)))
    child.on('close', (code, signal) =>
      settle(() => {
        if (code === 0) return resolve(stdout)
        const why = code === null ? `signal_${signal}` : `exit_${code}`
        reject(new GithubError(lastLine(stderr) ?? `gh ended with ${why}`, why))
      })
    )
  })
}

// The real port: `command` (default `gh`) with `prefixArgs` before `pr view <url> --json …`; a url
// that is not https:// is refused (code bad_url) and gh is not run.
// With no command given, under the Firestore emulator, it answers EMULATOR_STATUS and runs nothing.
export function ghPort(opts: { command?: string; prefixArgs?: string[] } = {}): GithubPort {
  const prefixArgs = opts.prefixArgs ?? []
  if (opts.command === undefined && process.env.FIRESTORE_EMULATOR_HOST)
    return { prStatus: () => Promise.resolve({ ...EMULATOR_STATUS, checks: [] }) }
  const command = opts.command ?? 'gh'
  return {
    prStatus: async (url) => {
      // Only an https:// url is a PR url; anything else (an option, a path) never reaches gh.
      if (!url.startsWith('https://'))
        throw new GithubError(`not an https PR url: ${url}`, 'bad_url')
      return parseAnswer(
        await runGh(command, [...prefixArgs, 'pr', 'view', url, '--json', GH_FIELDS])
      )
    },
  }
}
