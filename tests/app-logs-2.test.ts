// app-logs L1, criterion 2 (the logger half): "the app behaves exactly as today". Without a
// transport the vendored logger is unchanged: with log_endpoint null (app.manifest.yaml today)
// nothing leaves the page; with an endpoint, batches go to it by POST and by sendBeacon when the
// page is hidden. Regression guards: these pass before and after the feature. The signed-out
// half (nothing stored) runs in tests/emulator/app-logs-2.test.ts.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { browserLogger } from './fixtures/app-logs.ts'

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('L1-2 without a transport the logger behaves as today', () => {
  it('sends nothing anywhere while log_endpoint is null', async () => {
    vi.useFakeTimers()
    const { log, fetch, sendBeacon, hide } = browserLogger()
    log.error('feature_error', 'Boom', { feature: 'thread' })
    await log.flush()
    await vi.advanceTimersByTimeAsync(30_000)
    hide()
    expect(fetch).not.toHaveBeenCalled()
    expect(sendBeacon).not.toHaveBeenCalled()
  })

  it('posts to the endpoint, and beacons when the page is hidden, once one is set', async () => {
    const endpoint = 'https://logs.example.test/ingest'
    const { log, fetch, sendBeacon, hide } = browserLogger({ endpoint })
    log.error('feature_error', 'Boom', { feature: 'thread' })
    await log.flush()
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(fetch.mock.calls[0][0]).toBe(endpoint)
    const body = JSON.parse((fetch.mock.calls[0][1] as { body: string }).body)
    expect(body.events.map((e: { event_type: string }) => e.event_type)).toContain('feature_error')
    log.warn('api_call_failed', 'Later', { target: 't', status: 's' })
    hide()
    expect(sendBeacon).toHaveBeenCalledTimes(1)
    expect(sendBeacon.mock.calls[0][0]).toBe(endpoint)
  })
})
