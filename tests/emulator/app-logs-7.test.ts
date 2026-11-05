// app-logs L1, criterion 7: an agent that keeps failing stores at most AGENT_LOG_MAX_PER_MINUTE
// (20) events in any rolling minute; the rest still go to stderr and agent.log. The agent's
// logFailure in-process against the emulator (`npm run test:rules`); this file is its own
// process, so the budget starts empty.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AGENT_LOG_MAX_PER_MINUTE } from '../../packages/shared/src/index.ts'
import { logFailure } from '../../packages/agent/src/app-log.ts'
import { agentLogs, clearLogs } from '../fixtures/app-logs-emulator.ts'

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

const fail = (i: number) =>
  logFailure({
    severity: 'WARNING',
    event_type: 'api_call_failed',
    message: `heartbeat failed #${i}`,
    context: { target: 'firestore', status: 'unavailable' },
  })
const burst = () => agentLogs((e) => String(e.message).startsWith('heartbeat failed #'))

describe('L1-7 repeated agent failures', () => {
  it('stores 20 in a minute; every one is still written to stderr', async () => {
    expect(AGENT_LOG_MAX_PER_MINUTE).toBe(20)
    await clearLogs()
    const lines = vi.spyOn(console, 'error')
    for (let i = 0; i < 25; i++) await fail(i)
    const written = lines.mock.calls.map((c) => String(c[0]))
    for (let i = 0; i < 25; i++)
      expect(written.some((l) => l.includes(`heartbeat failed #${i}`))).toBe(true)
    const stored = (await burst()).map((e) => e.message)
    expect(stored).toHaveLength(20)
    expect(stored.sort()).toEqual(
      Array.from({ length: 20 }, (_, i) => `heartbeat failed #${i}`).sort()
    )
  })

  it('stores again once the minute has rolled on', async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: Date.now() + 61_000 })
    await fail(100)
    expect((await burst()).map((e) => e.message)).toContain('heartbeat failed #100')
  })

  it('the minute is rolling, not the clock minute', async () => {
    // A burst at hh:mm:50, well after the earlier tests' events; hh:(mm+1):20 is a new clock
    // minute but still inside the 60 s after the burst.
    const at = Math.ceil((Date.now() + 10 * 60_000) / 60_000) * 60_000 + 50_000
    vi.useFakeTimers({ toFake: ['Date'], now: at })
    const listener = (i: number) =>
      logFailure({
        severity: 'ERROR',
        event_type: 'api_call_failed',
        message: `listener failed #${i}`,
        context: { target: 'firestore', status: 'unavailable' },
      })
    const stored = async () =>
      (await agentLogs((e) => String(e.message).startsWith('listener failed #'))).map(
        (e) => e.message as string
      )
    for (let i = 0; i < 20; i++) await listener(i)
    expect(await stored()).toHaveLength(20)

    vi.setSystemTime(at + 30_000)
    const lines = vi.spyOn(console, 'error')
    await listener(20)
    expect(lines.mock.calls.some((c) => String(c[0]).includes('listener failed #20'))).toBe(true)
    expect(await stored()).not.toContain('listener failed #20')

    vi.setSystemTime(at + 61_000)
    await listener(21)
    expect(await stored()).toContain('listener failed #21')
  })

  it('the window rolls with each event, not from the first one', async () => {
    // Well after the earlier tests' events: 1 at T, 19 at T+40 s; at T+61 s the 19 are still
    // inside the last 60 s, so only one more fits.
    const at = Math.ceil((Date.now() + 30 * 60_000) / 60_000) * 60_000
    vi.useFakeTimers({ toFake: ['Date'], now: at })
    const announce = (i: number) =>
      logFailure({
        severity: 'WARNING',
        event_type: 'api_call_failed',
        message: `announce failed #${i}`,
        context: { target: 'firestore', status: 'unavailable' },
      })
    const stored = async () =>
      (await agentLogs((e) => String(e.message).startsWith('announce failed #'))).map(
        (e) => e.message as string
      )
    await announce(0)
    expect(await stored()).toHaveLength(1)

    vi.setSystemTime(at + 40_000)
    for (let i = 1; i < 20; i++) await announce(i)
    expect(await stored()).toHaveLength(20)

    vi.setSystemTime(at + 61_000)
    const lines = vi.spyOn(console, 'error')
    await announce(20)
    await announce(21)
    const written = lines.mock.calls.map((c) => String(c[0]))
    for (const i of [20, 21])
      expect(written.some((l) => l.includes(`announce failed #${i}`))).toBe(true)
    const after = await stored()
    expect(after).toContain('announce failed #20')
    expect(after).not.toContain('announce failed #21')
    expect(after).toHaveLength(21)
  })

  it('a steady trickle fills the window whatever the clock phase', async () => {
    // Well after the earlier tests' events: one failure every 3 s from U to U+57 s. Any fixed
    // 60 s grid not starting exactly at U resets inside that run; the rolling window does not.
    const at = Math.ceil((Date.now() + 60 * 60_000) / 60_000) * 60_000 - 500 // off any boundary
    vi.useFakeTimers({ toFake: ['Date'], now: at })
    const beat = (i: number) =>
      logFailure({
        severity: 'WARNING',
        event_type: 'api_call_failed',
        message: `trickle failed #${i}`,
        context: { target: 'firestore', status: 'unavailable' },
      })
    const stored = async () =>
      (await agentLogs((e) => String(e.message).startsWith('trickle failed #'))).map(
        (e) => e.message as string
      )
    for (let i = 0; i < 20; i++) {
      vi.setSystemTime(at + i * 3_000)
      await beat(i)
    }
    expect(await stored()).toHaveLength(20)

    vi.setSystemTime(at + 58_000)
    const lines = vi.spyOn(console, 'error')
    await beat(20)
    expect(lines.mock.calls.some((c) => String(c[0]).includes('trickle failed #20'))).toBe(true)
    expect(await stored()).not.toContain('trickle failed #20')

    vi.setSystemTime(at + 61_000)
    await beat(21)
    const after = await stored()
    expect(after).toContain('trickle failed #21')
    expect(after).toHaveLength(21)
  })
})
