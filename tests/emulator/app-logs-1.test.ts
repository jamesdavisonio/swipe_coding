// app-logs L1, criterion 1 (the storing half): with James signed in, an event the web app logs
// through lib/log.ts is stored in `logs` at the logger's next flush, with its time, severity,
// event type, message, context, source web_client, session id and request id (the 18 fields of
// the contract). An event logged while offline is stored once the app is back online.
// The real lib/log.ts, logger and log store against the emulator (`npm run test:rules`).
import { disableNetwork, enableNetwork } from 'firebase/firestore'
import { describe, expect, it, vi } from 'vitest'
import {
  RETENTION,
  STORED_KEYS,
  appDb,
  byRequest,
  serverSide,
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

describe('L1-1 the web app stores what it logs', () => {
  // The first flush of the page also carries the logger's session start.
  it('stores a warning with every field at the next flush', async () => {
    log.warn('api_call_failed', 'Saving the reply failed', {
      target: 'firestore',
      status: 'unavailable',
      request_id: 'r-1a',
    })
    await log.flush()
    const stored = await storedLogs()
    const start = stored.find((s) => s.event_type === 'session_start')
    const [e] = byRequest(stored, 'r-1a')
    expect(e).toBeDefined()
    expect(Object.keys(e).sort()).toEqual(STORED_KEYS)
    expect(e).toEqual(
      expect.objectContaining({
        schema_version: 1,
        taxonomy_version: 6,
        severity: 'WARNING',
        app_id: 'kanban',
        client_id: 'jamesdavisonio',
        env: 'prod',
        source: 'web_client',
        event_type: 'api_call_failed',
        audience: 'internal',
        session_id: expect.stringMatching(/.+/),
        trace_id: null,
        user_id: null,
        message: 'Saving the reply failed',
        context: { target: 'firestore', status: 'unavailable', request_id: 'r-1a' },
        request_id: 'r-1a',
      })
    )
    expect(e.ts).toBe(Date.parse(e.timestamp))
    expect(e.expireAt.toMillis()).toBe(e.ts + RETENTION)
    expect(start).toEqual(expect.objectContaining({ severity: 'INFO', request_id: null }))
    expect(start?.session_id).toBe(e.session_id)
  })

  it('stores errors and critical events', async () => {
    log.error('feature_error', 'Thread crashed', { feature: 'thread', request_id: 'r-1b' })
    log.critical('feature_error', 'Board down', { feature: 'board', request_id: 'r-1c' })
    await log.flush()
    const stored = await storedLogs()
    expect(byRequest(stored, 'r-1b').map((e) => e.severity)).toEqual(['ERROR'])
    expect(byRequest(stored, 'r-1c').map((e) => e.severity)).toEqual(['CRITICAL'])
  })

  it('stores a request id only when the context holds it as a string', async () => {
    log.warn('api_call_failed', 'Numeric request id', {
      target: 'firestore',
      status: 'unavailable',
      request_id: 42,
    })
    log.warn('api_call_failed', 'String request id', {
      target: 'firestore',
      status: 'unavailable',
      request_id: 'r-1e',
    })
    await log.flush()
    const stored = await storedLogs()
    const numeric = stored.filter((e) => e.message === 'Numeric request id')
    expect(numeric).toHaveLength(1)
    expect(numeric[0].request_id).toBe(null)
    expect(byRequest(stored, 'r-1e').map((e) => e.message)).toEqual(['String request id'])
  })

  it('stores an event logged while offline once the app is back online', async () => {
    await disableNetwork(appDb())
    try {
      log.warn('api_call_failed', 'Offline save', {
        target: 'firestore',
        status: 'unavailable',
        request_id: 'r-1d',
      })
      await log.flush() // must not wait for the server
      expect(byRequest(await serverSide(), 'r-1d')).toEqual([])
    } finally {
      await enableNetwork(appDb())
    }
    expect(byRequest(await storedLogs(), 'r-1d').map((e) => e.message)).toEqual(['Offline save'])
  })
})
