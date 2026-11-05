// app-logs L1, criterion 3 (the logger half): when storing a batch fails, the app keeps working,
// shows nothing, retries no more than the logger's existing bound (MAX_RETRIES = 3, backoff
// 1 s then 2 s) and does not log the failure of logging. On the hide path the transport is
// called once, not retried. The log-store half runs in tests/emulator/app-logs-3.test.ts.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { browserLogger, handed, type Transport } from './fixtures/app-logs.ts'

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

// Every call fails, the way a refused or failed batch write does.
const failing = () => vi.fn<Transport>(() => Promise.reject(new Error('permission-denied')))

describe('L1-3 a failing store', () => {
  it('is retried at most three times with backoff, then the batch is dropped quietly', async () => {
    vi.useFakeTimers()
    const consoleSpies = [vi.spyOn(console, 'error'), vi.spyOn(console, 'warn')]
    const transport = failing()
    const { log } = browserLogger({ transport })
    log.error('feature_error', 'Boom', { feature: 'thread' })
    const flushed = log.flush()
    await vi.advanceTimersByTimeAsync(1)
    expect(transport).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(998) // backoff: not before a second has passed
    expect(transport).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(60_000)
    await expect(flushed).resolves.toBeUndefined()
    expect(transport).toHaveBeenCalledTimes(3)
    for (const s of consoleSpies) expect(s).not.toHaveBeenCalled()
  })

  it('logs nothing about it: the next batch holds only what the app logged', async () => {
    vi.useFakeTimers()
    let fail = true
    const transport = vi.fn<Transport>(() =>
      fail ? Promise.reject(new Error('unavailable')) : Promise.resolve()
    )
    const { log } = browserLogger({ transport })
    log.error('feature_error', 'Boom', { feature: 'thread' })
    const first = log.flush()
    await vi.advanceTimersByTimeAsync(60_000)
    await first
    const failedCalls = transport.mock.calls.length
    expect(failedCalls).toBeGreaterThan(0)
    fail = false
    log.warn('api_call_failed', 'Next', { target: 'firestore', status: 'unavailable' })
    await log.flush()
    const next = transport.mock.calls.slice(failedCalls).flatMap((c) => c[0])
    expect(next.map((e) => `${e.event_type}: ${e.message}`)).toEqual(['api_call_failed: Next'])
  })

  it('on the hide path is tried once and never throws into the page', async () => {
    vi.useFakeTimers()
    const rejections: unknown[] = []
    const onRejection = (r: unknown) => rejections.push(r)
    process.on('unhandledRejection', onRejection)
    try {
      const transport = failing()
      const { log, hide } = browserLogger({ transport })
      log.warn('api_call_failed', 'Delivery failed', { target: 'channel', status: 'failed' })
      expect(() => hide()).not.toThrow()
      await vi.advanceTimersByTimeAsync(60_000)
      expect(transport).toHaveBeenCalledTimes(1)
      expect(handed(transport).map((e) => e.event_type)).toContain('api_call_failed')
      vi.useRealTimers()
      await new Promise((r) => setImmediate(r)) // one turn for Node to report a stray rejection
      expect(rejections).toEqual([])
    } finally {
      process.off('unhandledRejection', onRejection)
    }
  })
})
