// app-logs L1, criterion 1 (the logger half): every event the shared browser logger keeps reaches
// the board's log store at the logger's next flush. With a `transport` (lib/log.ts passes the
// log store), each batch the logger would POST is handed to it instead of fetch/sendBeacon:
// on flush, after ten seconds, at twenty events, and once when the page is hidden, whether or not
// the manifest has a log_endpoint. The storing half runs in tests/emulator/app-logs-1.test.ts.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { browserLogger, handed, type Transport } from './fixtures/app-logs.ts'

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

const spy = () => vi.fn<Transport>(() => Promise.resolve())

describe('L1-1 the logger hands kept events to the transport', () => {
  it('on flush, with every field the store needs and no network call', async () => {
    const transport = spy()
    const { log, fetch, sendBeacon } = browserLogger({ transport })
    log.warn('api_call_failed', 'Delivery failed', {
      target: 'firestore',
      status: 'unavailable',
      request_id: 'r-1',
    })
    await log.flush()
    expect(transport).toHaveBeenCalledTimes(1)
    const warn = handed(transport).find((e) => e.event_type === 'api_call_failed')
    expect(warn).toEqual(
      expect.objectContaining({
        severity: 'WARNING',
        source: 'web_client',
        message: 'Delivery failed',
        context: { target: 'firestore', status: 'unavailable', request_id: 'r-1' },
        session_id: expect.stringMatching(/.+/),
      })
    )
    expect(Number.isNaN(Date.parse(warn!.timestamp))).toBe(false)
    expect(handed(transport).map((e) => e.event_type)).toContain('session_start')
    expect(fetch).not.toHaveBeenCalled()
    expect(sendBeacon).not.toHaveBeenCalled()
  })

  it('uses the transport even when the manifest has a log_endpoint', async () => {
    const transport = spy()
    const { log, fetch, sendBeacon } = browserLogger({
      transport,
      endpoint: 'https://logs.example.test/ingest',
    })
    log.error('feature_error', 'Boom', { feature: 'thread' })
    await log.flush()
    expect(handed(transport).map((e) => e.event_type)).toContain('feature_error')
    expect(fetch).not.toHaveBeenCalled()
    expect(sendBeacon).not.toHaveBeenCalled()
  })

  it('flushes on its own within ten seconds', async () => {
    vi.useFakeTimers()
    const transport = spy()
    const { log } = browserLogger({ transport })
    log.error('feature_error', 'Boom', { feature: 'thread' })
    await vi.advanceTimersByTimeAsync(9_000)
    expect(transport).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1_000)
    expect(transport).toHaveBeenCalledTimes(1)
    expect(handed(transport).map((e) => e.event_type)).toEqual(['session_start', 'feature_error'])
  })

  it('flushes at twenty events', async () => {
    vi.useFakeTimers()
    const transport = spy()
    const { log } = browserLogger({ transport })
    for (let i = 0; i < 19; i++) log.warn('api_call_failed', `w${i}`, { target: 't', status: 's' })
    await vi.advanceTimersByTimeAsync(1) // well before the ten-second flush
    expect(transport).toHaveBeenCalledTimes(1)
    expect(transport.mock.calls[0][0]).toHaveLength(20)
  })

  it('hands the batch over once when the page is hidden, and session end when it closes', async () => {
    vi.useFakeTimers()
    const transport = spy()
    const { log, hide, pagehide, fetch, sendBeacon } = browserLogger({ transport })
    log.warn('api_call_failed', 'Delivery failed', { target: 'channel', status: 'failed' })
    hide()
    await vi.advanceTimersByTimeAsync(1)
    expect(transport).toHaveBeenCalledTimes(1)
    expect(handed(transport).map((e) => e.event_type)).toContain('api_call_failed')
    pagehide()
    await vi.advanceTimersByTimeAsync(1)
    expect(handed(transport).map((e) => e.event_type)).toContain('session_end')
    expect(fetch).not.toHaveBeenCalled()
    expect(sendBeacon).not.toHaveBeenCalled()
  })

  it('keeps warnings, errors, critical events, milestones and its sample of taps', async () => {
    const transport = spy()
    const { log } = browserLogger({ transport })
    const random = vi.spyOn(Math, 'random')
    random.mockReturnValue(0.05) // inside the 10% sample
    log.info('user_action', 'user_action', { action: 'open_thread' })
    random.mockReturnValue(0.5) // outside it
    log.info('user_action', 'user_action', { action: 'scroll' })
    log.critical('feature_error', 'Down', { feature: 'board' })
    log.info('milestone_reached', 'First task', { milestone: 'first_task' })
    log.error('feature_error', 'Boom', { feature: 'thread' })
    await log.flush()
    const kept = handed(transport)
    expect(kept.filter((e) => e.event_type === 'user_action').map((e) => e.context)).toEqual([
      { action: 'open_thread' },
    ])
    expect(kept.map((e) => `${e.severity} ${e.event_type}`)).toEqual(
      expect.arrayContaining([
        'CRITICAL feature_error',
        'INFO milestone_reached',
        'ERROR feature_error',
      ])
    )
  })
})
