// app-logs L1, criterion 2 (the storing half): with James signed out, nothing the web app logs is
// stored, not even once he signs in again, and logging carries on as today (no error, nothing
// thrown). The real lib/log.ts and log store against the emulator (`npm run test:rules`); the
// app's Firestore is James's, so only the signed-out check keeps the write out.
import { describe, expect, it, vi } from 'vitest'
import {
  byRequest,
  signIn,
  signOut,
  storedLogs,
  useWebEmulator,
} from '../fixtures/app-logs-emulator.ts'
import type { LogEvent } from '../fixtures/app-logs.ts'

vi.mock('virtual:app-manifest', async () =>
  (await import('../fixtures/app-logs-emulator.ts')).manifestModule()
)
vi.mock('../../packages/web/src/firebase.ts', async () =>
  (await import('../fixtures/app-logs-emulator.ts')).firebaseModule()
)
import { log } from '../../packages/web/src/lib/log.ts'

useWebEmulator()

const event = (request_id: string): LogEvent => ({
  schema_version: 1,
  taxonomy_version: 6,
  timestamp: new Date().toISOString(),
  severity: 'ERROR',
  app_id: 'kanban',
  client_id: 'jamesdavisonio',
  env: 'prod',
  source: 'web_client',
  event_type: 'feature_error',
  audience: 'internal',
  session_id: 's-2',
  trace_id: null,
  user_id: null,
  message: 'Boom',
  context: { feature: 'thread', request_id },
})

describe('L1-2 signed out, nothing is stored', () => {
  it('the log store writes nothing and resolves', async () => {
    const { storeLogEvents } = await import('../../packages/web/src/lib/log-store.ts')
    signOut()
    await expect(storeLogEvents([event('r-2a')])).resolves.toBeUndefined()
    expect(await storedLogs()).toEqual([])
  })

  it('events logged while signed out are dropped, not stored after sign-in', async () => {
    signOut()
    log.error('feature_error', 'Signed-out crash', { feature: 'thread', request_id: 'r-2b' })
    await expect(log.flush()).resolves.toBeUndefined()
    expect(await storedLogs()).toEqual([])
    signIn()
    log.error('feature_error', 'Signed-in crash', { feature: 'thread', request_id: 'r-2c' })
    await log.flush()
    const stored = await storedLogs()
    expect(byRequest(stored, 'r-2b')).toEqual([])
    expect(byRequest(stored, 'r-2c').map((e) => e.message)).toEqual(['Signed-in crash'])
  })
})
