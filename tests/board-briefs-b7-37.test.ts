// board-briefs B7, criterion 37: the instructions a new session receives when it connects (the
// MCP server's `instructions`, now SESSION_INSTRUCTIONS in packages/agent/src/instructions.ts and
// passed by index.ts) tell it how to post briefs: the spec brief as the note when it sets spec to
// awaiting_approval; fix, round and summary briefs as a kanban_ask question ending with the
// `Reply "<phrase>"` line; the pull request with pr_url once it is open; and to finish with status
// "done" and a summary that ends with `### Suggested next` (one per line) when it has follow-ups.
// Each rule is checked within one paragraph or numbered step, so the words belong together.
import { spawn } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { SESSION_INSTRUCTIONS } from '../packages/agent/src/instructions.ts'

// The paragraphs and numbered steps of the instructions.
const chunks = (text: string) =>
  text
    .split(/\n\s*\n|\n(?=\s*\d+\.\s)/)
    .map((c) => c.replace(/\s+/g, ' ').trim())
    .filter(Boolean)

// The paragraphs or steps that mention every one of `words` (strings or patterns).
const saying = (...words: (string | RegExp)[]) =>
  chunks(SESSION_INSTRUCTIONS).filter((c) =>
    words.every((w) => (typeof w === 'string' ? c.includes(w) : w.test(c)))
  )

// Starts the real agent over stdio, offline, the way packages/agent/test/protocol.ts does: no
// emulator, and KANBAN_SA pointed at this test file (it exists but is not a key), so the agent's
// Firestore init fails before it could reach any real key on this machine. Sends initialize and
// returns its result; closing stdin then shuts the agent down.
const ROOT = join(import.meta.dirname, '..')
async function initializeAgent(): Promise<{ instructions?: string }> {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    KANBAN_SA: fileURLToPath(import.meta.url),
    KANBAN_PROJECT_ID: 'demo-kanban',
  }
  delete env.FIRESTORE_EMULATOR_HOST
  delete env.KANBAN_TEST_LIVE
  const child = spawn(process.execPath, [join(ROOT, 'packages', 'agent', 'src', 'index.ts')], {
    env,
    cwd: ROOT,
    stdio: ['pipe', 'pipe', 'pipe'],
  })
  child.stderr.resume()
  try {
    return await new Promise((resolve, reject) => {
      let buf = ''
      child.on('error', reject)
      child.on('exit', (code) => reject(new Error(`agent exited (${code}) before initialize`)))
      child.stdout.on('data', (d: Buffer) => {
        buf += d.toString()
        for (let i = buf.indexOf('\n'); i >= 0; i = buf.indexOf('\n')) {
          const line = buf.slice(0, i).trim()
          buf = buf.slice(i + 1)
          if (!line) continue
          const msg = JSON.parse(line) as { id?: number; result?: { instructions?: string } }
          if (msg.id === 1) resolve(msg.result ?? {})
        }
      })
      const initialize = {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-06-18',
          capabilities: {},
          clientInfo: { name: 'board-briefs-b7-37', version: '0' },
        },
      }
      child.stdin.write(`${JSON.stringify(initialize)}\n`)
    })
  } finally {
    child.stdin.end()
    child.kill()
  }
}

describe('B7-37 the session instructions', () => {
  it('is a non-empty text that still explains the channel', () => {
    expect(typeof SESSION_INSTRUCTIONS).toBe('string')
    expect(SESSION_INSTRUCTIONS).toContain('from="james"')
    expect(SESSION_INSTRUCTIONS).toContain('kanban_ask')
  })

  it('says to post the spec brief as the note when setting spec to awaiting_approval', () => {
    expect(
      saying('awaiting_approval', /\bnote\b/, /spec brief|decision brief \(spec\)/i)
    ).not.toEqual([])
  })

  it('says to post fix, round and summary briefs as a kanban_ask question ending with the Reply line', () => {
    expect(
      saying('kanban_ask', /\bfix\b/, /\bround\b/, /\bsummary\b/, /brief/i, 'Reply "')
    ).not.toEqual([])
  })

  it('says to report the pull request with pr_url once it is open', () => {
    expect(saying('pr_url', /\bPR\b|pull request/i)).not.toEqual([])
  })

  it('says to finish with status done and a summary ending with ### Suggested next', () => {
    expect(
      saying(
        /\bdone\b/,
        /\bsummary\b/,
        '### Suggested next',
        /one (suggestion )?per line/i,
        /follow-?ups?/i
      )
    ).not.toEqual([])
  })

  it('is what the MCP server sends: initialize returns SESSION_INSTRUCTIONS', async () => {
    expect((await initializeAgent()).instructions).toBe(SESSION_INSTRUCTIONS)
  }, 30_000)
})
