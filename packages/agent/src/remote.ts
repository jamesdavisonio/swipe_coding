// The session's Claude-app link, for the board's "Open in Claude". Claude Code writes one JSON
// file per running session, <home>/.claude/sessions/<pid>.json; while Remote Control is on it
// holds `bridgeSessionId: "session_<id>"`, the last part of the session's claude.ai link. The
// file is outside this code's control, so anything but exactly that shape reads as "no link".
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { z } from 'zod'

const REMOTE_BASE = 'https://claude.ai/code/'

// A process id, as a number or as the digits of one (CLAUDE_PID): never a path.
const Pid = z.union([z.number().int().nonnegative(), z.string().regex(/^\d+$/)])
const SessionFile = z.object({
  bridgeSessionId: z.string().regex(/^session_[A-Za-z0-9]+$/),
})

// The JSON in `path`; undefined when the file is missing (no such session, or no Remote Control),
// cannot be read, or is not JSON. None of these is an error for the caller: it means no link.
function readJson(path: string): unknown {
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as unknown
  } catch {
    return undefined
  }
}

// `https://claude.ai/code/session_<id>` from `<dir>/<pid>.json`, or null when there is no link.
export function readRemoteUrl(opts: { dir: string; pid: number | string }): string | null {
  const pid = Pid.safeParse(opts.pid)
  if (!pid.success) return null
  const parsed = SessionFile.safeParse(readJson(join(opts.dir, `${pid.data}.json`)))
  return parsed.success ? `${REMOTE_BASE}${parsed.data.bridgeSessionId}` : null
}
