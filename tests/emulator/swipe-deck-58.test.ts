// swipe-deck 58 in the Firestore emulator (`npm run test:rules`): the agent keeps `remoteUrl`
// (string or null) on its agent document, written when it registers and refreshed on each
// heartbeat, writing only when the value changed (Board.refreshRemoteUrl, which registration and
// the heartbeat use). The sessions file is placed under a temporary home (HOME / USERPROFILE) at
// <home>/.claude/sessions/<CLAUDE_PID>.json, which the agent reads at call time.
// The "each kanban tool call" call site lives in the MCP server (index.ts) and is not covered here.
import { DocumentReference } from 'firebase-admin/firestore'
import { mkdirSync, mkdtempSync, rmSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AGENT_HEARTBEAT_MS, type AgentDoc } from '../../packages/shared/src/index.ts'
import { Board } from '../../packages/agent/src/board.ts'

let home = ''
const PID = '424242'
const saved = {
  HOME: process.env.HOME,
  USERPROFILE: process.env.USERPROFILE,
  CLAUDE_PID: process.env.CLAUDE_PID,
}
const sessionFile = () => join(home, '.claude', 'sessions', `${PID}.json`)
const setBridge = (id: string) =>
  writeFileSync(sessionFile(), JSON.stringify({ bridgeSessionId: id }))

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), 'swipe-deck-58-'))
  mkdirSync(join(home, '.claude', 'sessions'), { recursive: true })
  process.env.HOME = home
  process.env.USERPROFILE = home
  process.env.CLAUDE_PID = PID
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) delete process.env[k]
    else process.env[k] = v
  }
  rmSync(home, { recursive: true, force: true })
})

const readAgent = async (board: Board) =>
  (await board.db.collection('agents').doc(board.id.agentId).get()).data() as Omit<AgentDoc, 'id'>

describe('swipe-deck 58: remoteUrl on the agent document', () => {
  it('is null on registration when there is no sessions file', async () => {
    const board = new Board(`/tmp/swipe-deck-58-none-${Date.now()}`)
    await board.register()
    try {
      const agent = await readAgent(board)
      expect('remoteUrl' in agent).toBe(true)
      expect(agent.remoteUrl).toBeNull()
    } finally {
      await board.shutdown()
    }
  })

  it('is the claude.ai link on registration when the sessions file has a bridge id', async () => {
    setBridge('session_01Abc')
    const board = new Board(`/tmp/swipe-deck-58-link-${Date.now()}`)
    await board.register()
    try {
      expect((await readAgent(board)).remoteUrl).toBe('https://claude.ai/code/session_01Abc')
    } finally {
      await board.shutdown()
    }
  })

  it('refreshRemoteUrl follows the file, writes only on change, and goes back to null', async () => {
    setBridge('session_one')
    const board = new Board(`/tmp/swipe-deck-58-refresh-${Date.now()}`)
    await board.register()
    const agentPath = `agents/${board.id.agentId}`
    const writes: unknown[] = []
    const original = Reflect.get(DocumentReference.prototype, 'update') as (
      this: DocumentReference,
      ...a: unknown[]
    ) => Promise<unknown>
    vi.spyOn(DocumentReference.prototype, 'update').mockImplementation(function (
      this: DocumentReference,
      ...args: unknown[]
    ) {
      if (this.path === agentPath) writes.push(args[0])
      return original.apply(this, args) as never
    } as never)
    try {
      await board.refreshRemoteUrl()
      expect(writes).toHaveLength(0)
      expect((await readAgent(board)).remoteUrl).toBe('https://claude.ai/code/session_one')

      setBridge('session_two')
      await board.refreshRemoteUrl()
      expect(writes).toHaveLength(1)
      expect((await readAgent(board)).remoteUrl).toBe('https://claude.ai/code/session_two')

      await board.refreshRemoteUrl()
      expect(writes).toHaveLength(1)

      unlinkSync(sessionFile())
      await board.refreshRemoteUrl()
      expect(writes).toHaveLength(2)
      expect((await readAgent(board)).remoteUrl).toBeNull()
    } finally {
      vi.restoreAllMocks()
      await board.shutdown()
    }
  }, 30_000)

  it('a heartbeat refreshes remoteUrl when the file changed, and writes none when it did not', async () => {
    setBridge('session_one')
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'], now: Date.now() })
    const board = new Board(`/tmp/swipe-deck-58-beat-${Date.now()}`)
    await board.register()
    const agentPath = `agents/${board.id.agentId}`
    const payloads: Record<string, unknown>[] = []
    const pending: Promise<unknown>[] = []
    const watch = (method: 'update' | 'set') => {
      const original = Reflect.get(DocumentReference.prototype, method) as (
        this: DocumentReference,
        ...a: unknown[]
      ) => Promise<unknown>
      vi.spyOn(DocumentReference.prototype, method).mockImplementation(function (
        this: DocumentReference,
        ...args: unknown[]
      ) {
        if (this.path === agentPath) payloads.push(args[0] as Record<string, unknown>)
        const result = original.apply(this, args)
        pending.push(result)
        return result as never
      } as never)
    }
    watch('update')
    watch('set')
    try {
      await vi.advanceTimersByTimeAsync(AGENT_HEARTBEAT_MS)
      await Promise.all(pending)
      expect(payloads.length).toBeGreaterThan(0)
      expect(payloads.some((p) => 'remoteUrl' in p)).toBe(false)
      expect((await readAgent(board)).remoteUrl).toBe('https://claude.ai/code/session_one')

      setBridge('session_two')
      await vi.advanceTimersByTimeAsync(AGENT_HEARTBEAT_MS)
      await Promise.all(pending)
      expect((await readAgent(board)).remoteUrl).toBe('https://claude.ai/code/session_two')
    } finally {
      vi.useRealTimers()
      vi.restoreAllMocks()
      await board.shutdown()
    }
  }, 30_000)
})
