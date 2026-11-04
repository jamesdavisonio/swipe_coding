// Reproduction for the Firestore quota drain (2026-11-04): every running agent wrote its
// heartbeat every 30 s, so twelve agents left open (two per session, from the double spawn)
// made about 34,500 writes a day against the free plan's 20,000. Runs a real agent
// registration against the emulator with a fake clock and counts its heartbeat writes.
//
// Budget: an always-on agent may write at most 12 heartbeats an hour (one every five
// minutes), so twelve always-on agents stay under a fifth of the daily free write quota.
// And the fix must not trade presence for quota: an agent that is heartbeating is reported
// online at every moment, so the board's live dot never flickers off between beats.
import { DocumentReference } from 'firebase-admin/firestore'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { isAgentOnline } from '../../packages/shared/src/index.ts'
import { Board } from '../../packages/agent/src/board.ts'

const MINUTE = 60 * 1000
const MAX_BEATS_PER_HOUR = 12

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('agent heartbeat', () => {
  it('writes at most 12 heartbeats an hour and is online at every minute of it', async () => {
    // The interval and the clock are fake from before registration, so the agent's own
    // heartbeat timer is the one being advanced; network I/O keeps its real timers.
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'], now: Date.now() })
    const board = new Board(`/tmp/heartbeat-${Date.now()}`)
    await board.register()
    const agentPath = `agents/${board.id.agentId}`

    // Count only this agent's heartbeat updates.
    const beats: number[] = []
    let lastSeen = Date.now()
    vi.spyOn(DocumentReference.prototype, 'update').mockImplementation(function (
      this: DocumentReference,
      data: unknown
    ) {
      if (this.path === agentPath) {
        const seen = (data as { lastSeen?: number }).lastSeen
        if (typeof seen === 'number') {
          beats.push(seen)
          lastSeen = seen
        }
      }
      return Promise.resolve({} as never)
    })

    try {
      for (let minute = 1; minute <= 60; minute++) {
        vi.advanceTimersByTime(MINUTE)
        expect(isAgentOnline({ lastSeen }, Date.now())).toBe(true)
      }
      expect(beats.length).toBeGreaterThan(0)
      expect(beats.length).toBeLessThanOrEqual(MAX_BEATS_PER_HOUR)
    } finally {
      vi.useRealTimers()
      vi.restoreAllMocks()
      await board.shutdown()
    }
  }, 30_000)
})
