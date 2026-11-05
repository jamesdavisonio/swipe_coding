// app-logs L1, criterion 4: a context key listed in logging/pii-keys.json never reaches the store
// (the logger's stripping applies first); the stored context is flat; the message is capped at
// LOG_MESSAGE_MAX (2000), the context keeps its first LOG_CONTEXT_MAX_KEYS (30) keys and each
// string value is cut to LOG_CONTEXT_VALUE_MAX (1000). The real lib/log.ts, logger and log store
// against the emulator (`npm run test:rules`).
import { describe, expect, it, vi } from 'vitest'
import {
  LOG_CONTEXT_MAX_KEYS,
  LOG_CONTEXT_VALUE_MAX,
  LOG_MESSAGE_MAX,
} from '../../packages/shared/src/index.ts'
import piiKeys from '../../logging/pii-keys.json'
import { byRequest, storedLogs, useWebEmulator } from '../fixtures/app-logs-emulator.ts'

vi.mock('virtual:app-manifest', async () =>
  (await import('../fixtures/app-logs-emulator.ts')).manifestModule()
)
vi.mock('../../packages/web/src/firebase.ts', async () =>
  (await import('../fixtures/app-logs-emulator.ts')).firebaseModule()
)
import { log } from '../../packages/web/src/lib/log.ts'

useWebEmulator()

// The logger's context type allows only flat values; these tests pass what a caller might.
type AnyContext = Parameters<typeof log.warn>[2]
const warn = (message: string, context: Record<string, unknown>) =>
  log.warn('api_call_failed', message, context as AnyContext)

describe('L1-4 what the store keeps of an event', () => {
  it('the limits are the contract values', () => {
    expect([LOG_MESSAGE_MAX, LOG_CONTEXT_MAX_KEYS, LOG_CONTEXT_VALUE_MAX]).toEqual([2000, 30, 1000])
  })

  it('holds no PII key, and its context is flat', async () => {
    const pii = Object.fromEntries(piiKeys.strip.map((k) => [k, `secret-${k}`]))
    warn('Saving failed', {
      target: 'firestore',
      status: 'unavailable',
      request_id: 'r-4a',
      ...pii,
      Email: 'j@nullnoise.ai',
      detail: { code: 7, retry: true },
    })
    await log.flush()
    const [e] = byRequest(await storedLogs(), 'r-4a')
    expect(e?.context).toEqual({
      target: 'firestore',
      status: 'unavailable',
      request_id: 'r-4a',
      detail: '{"code":7,"retry":true}',
    })
    expect(JSON.stringify(e)).not.toContain('secret-')
    expect(JSON.stringify(e)).not.toContain('j@nullnoise.ai')
  })

  it('caps the message, the number of context keys and each string value', async () => {
    const extra = Object.fromEntries(
      Array.from({ length: 40 }, (_, i) => [`k${String(i).padStart(2, '0')}`, i])
    )
    warn('m'.repeat(2500), { request_id: 'r-4b', long: 'v'.repeat(1500), ...extra })
    await log.flush()
    const [e] = byRequest(await storedLogs(), 'r-4b')
    expect(e?.message).toBe('m'.repeat(2000))
    expect(Object.keys(e.context).sort()).toEqual(
      ['request_id', 'long', ...Object.keys(extra).slice(0, 28)].sort()
    )
    expect(e.context.long).toBe('v'.repeat(1000))
    for (const v of Object.values(e.context)) expect(typeof v).not.toBe('object')
  })
})
