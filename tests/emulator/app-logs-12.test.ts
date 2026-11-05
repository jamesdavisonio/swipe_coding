// app-logs L1, criterion 12: events older than 30 days are removed automatically once James has
// switched on retention (a Firestore TTL policy on `logs.expireAt`, set by the one-time command
// this feature hands him). The emulator does not run TTL, so what is checked is what TTL needs:
// every stored event, from the phone and from the agent, carries `expireAt` as a Firestore
// Timestamp exactly LOG_RETENTION_MS (30 days) after its `ts`.
// The real lib/log.ts and the agent's logFailure against the emulator (`npm run test:rules`).
import { Timestamp } from 'firebase/firestore'
import { Timestamp as AdminTimestamp } from 'firebase-admin/firestore'
import { describe, expect, it, vi } from 'vitest'
import { LOG_RETENTION_MS } from '../../packages/shared/src/index.ts'
import {
  RETENTION,
  agentLogs,
  byRequest,
  storedLogs,
  useWebEmulator,
} from '../fixtures/app-logs-emulator.ts'

vi.mock('virtual:app-manifest', async () =>
  (await import('../fixtures/app-logs-emulator.ts')).manifestModule()
)
vi.mock('../../packages/web/src/firebase.ts', async () =>
  (await import('../fixtures/app-logs-emulator.ts')).firebaseModule()
)
import { log } from '../../packages/web/src/lib/log.ts'

useWebEmulator()

describe('L1-12 stored events expire after 30 days', () => {
  it('the retention is 30 days', () => {
    expect(LOG_RETENTION_MS).toBe(RETENTION)
  })

  it('an event from the phone expires 30 days after it happened', async () => {
    log.error('feature_error', 'Thread crashed', { feature: 'thread', request_id: 'r-12a' })
    await log.flush()
    const [e] = byRequest(await storedLogs(), 'r-12a')
    expect(e?.expireAt).toBeInstanceOf(Timestamp)
    expect(e.expireAt.toMillis()).toBe(e.ts + RETENTION)
  })

  it('an event from the agent expires 30 days after it happened', async () => {
    const { logFailure } = await import('../../packages/agent/src/app-log.ts')
    await logFailure({
      severity: 'WARNING',
      event_type: 'api_call_failed',
      message: 'heartbeat failed',
      context: { target: 'firestore', status: 'unavailable' },
      request_id: 'r-12b',
    })
    const [e] = await agentLogs((d) => d.request_id === 'r-12b')
    expect(e?.expireAt).toBeInstanceOf(AdminTimestamp)
    expect(e.expireAt.toMillis()).toBe(e.ts + RETENTION)
  })
})
