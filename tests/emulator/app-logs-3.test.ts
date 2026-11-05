// app-logs L1, criterion 3 (the log-store half): when Firestore refuses the batch, the log store
// still resolves, never rejects (no stray rejection reaches the page), stores nothing and logs
// nothing about it, and the app keeps logging: the next event is stored once writes succeed
// again. The real lib/log.ts and log store against the emulator (`npm run test:rules`); the
// refusing Firestore is a signed-in browser the rules do not accept as James.
import { waitForPendingWrites } from 'firebase/firestore'
import { describe, expect, it, vi } from 'vitest'
import {
  appDb,
  serverSide,
  storedLogs,
  useOwnerDb,
  useRefusingDb,
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

// Runs `fn` and returns every unhandled rejection Node reports meanwhile.
async function strayRejections(fn: () => Promise<void>): Promise<unknown[]> {
  const seen: unknown[] = []
  const on = (r: unknown) => seen.push(r)
  process.on('unhandledRejection', on)
  try {
    await fn()
    await waitForPendingWrites(appDb()) // the refused commit has come back
    await new Promise((r) => setImmediate(r))
  } finally {
    process.off('unhandledRejection', on)
  }
  return seen
}

describe('L1-3 a refused batch', () => {
  it('the log store resolves, stores nothing and never rejects', async () => {
    const { storeLogEvents } = await import('../../packages/web/src/lib/log-store.ts')
    useRefusingDb()
    const rejections = await strayRejections(async () => {
      await expect(
        storeLogEvents([
          {
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
            session_id: 's-3',
            trace_id: null,
            user_id: null,
            message: 'Boom',
            context: { feature: 'thread' },
          },
        ])
      ).resolves.toBeUndefined()
    })
    expect(rejections).toEqual([])
    expect(await serverSide()).toEqual([])
  })

  it('the app keeps logging, and nothing about the failure is ever stored', async () => {
    useRefusingDb()
    const rejections = await strayRejections(async () => {
      log.error('feature_error', 'Refused crash', { feature: 'thread', request_id: 'r-3a' })
      await log.flush()
    })
    expect(rejections).toEqual([])
    expect(await serverSide()).toEqual([])
    useOwnerDb() // writes succeed again
    log.warn('api_call_failed', 'Next one', {
      target: 'firestore',
      status: 'ok',
      request_id: 'r-3b',
    })
    await log.flush()
    expect((await storedLogs()).map((e) => `${e.request_id} ${e.message}`)).toEqual([
      'r-3b Next one',
    ])
  })
})
