// app-logs L1, criterion 8: when the log store refuses or cannot be reached, the agent keeps
// working (logFailure resolves, never rejects) and keeps logging to stderr and agent.log (its own
// line plus exactly one line saying the store failed), and never stores a log about failing to
// store a log. The agent's logFailure in-process against the emulator (`npm run test:rules`);
// the store failure is every Firestore commit of this process rejecting while it runs.
import { WriteBatch } from 'firebase-admin/firestore'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { logFailure } from '../../packages/agent/src/app-log.ts'
import { agentLogs, clearLogs } from '../fixtures/app-logs-emulator.ts'

afterEach(() => vi.restoreAllMocks())

const failures: [string, number, string][] = [
  ['refuses the write', 7, '7 PERMISSION_DENIED: refused'],
  ['is unreachable', 14, '14 UNAVAILABLE: no connection'],
]

describe('L1-8 the log store fails under the agent', () => {
  for (const [what, code, message] of failures)
    it(`${what}: the agent carries on and logs nothing about it to the store`, async () => {
      await clearLogs()
      const commit = vi
        .spyOn(WriteBatch.prototype, 'commit')
        .mockImplementation(() => Promise.reject(Object.assign(new Error(message), { code })))
      const lines = vi.spyOn(console, 'error')
      await expect(
        logFailure({
          severity: 'ERROR',
          event_type: 'api_call_failed',
          message: 'board registration failed: deadline exceeded',
          context: { target: 'firestore', status: 'deadline-exceeded' },
        })
      ).resolves.toBeUndefined()
      expect(lines).toHaveBeenCalledTimes(2)
      expect(String(lines.mock.calls[0][0])).toContain('board registration failed')
      commit.mockRestore()
      lines.mockRestore()

      // The store is back: the next failure is stored, and nothing about the failed store is.
      await logFailure({
        severity: 'WARNING',
        event_type: 'api_call_failed',
        message: 'heartbeat failed: unavailable',
        context: { target: 'firestore', status: 'unavailable' },
      })
      expect((await agentLogs()).map((e) => e.message)).toEqual(['heartbeat failed: unavailable'])
    })
})
