// app-logs L1, criterion 9: a session that calls kanban_logs with no arguments gets the warnings,
// errors and critical events of the last 24 hours, newest first, at most 50, each with its time,
// severity, event type, source, message, request id and context. The real agent over stdio, with
// no task, against the emulator (`npm run test:rules`); events are seeded with the admin db.
import { beforeEach, describe, expect, it } from 'vitest'
import {
  LOGS_READ_DEFAULT_LIMIT,
  LOGS_READ_DEFAULT_MINUTES,
} from '../../packages/shared/src/index.ts'
import { SESSION_INSTRUCTIONS } from '../../packages/agent/src/instructions.ts'
import { asRead, clearLogs, logDoc, seedLogs, useAgent } from '../fixtures/app-logs-emulator.ts'

const agent = useAgent('9')
const read = (args: Record<string, unknown> = {}) =>
  agent().json<{ events: ReturnType<typeof asRead>[] }>('kanban_logs', args)

beforeEach(() => clearLogs())

describe('L1-9 kanban_logs with no arguments', () => {
  it('returns the last day of warnings and worse, newest first, in the read shape', async () => {
    const want = [
      logDoc({ minutesAgo: 1, severity: 'CRITICAL', source: 'web_client', request_id: 'r-9a' }),
      logDoc({ minutesAgo: 30, severity: 'WARNING', source: 'server', request_id: 'r-9b' }),
      logDoc({ minutesAgo: 120, severity: 'ERROR', source: 'web_client', request_id: null }),
      logDoc({ minutesAgo: 23 * 60, severity: 'WARNING', source: 'web_client' }),
    ]
    const not = [
      logDoc({ minutesAgo: 2, severity: 'INFO', source: 'web_client', request_id: 'r-9c' }),
      logDoc({ minutesAgo: 3, severity: 'DEBUG', source: 'server' }),
      logDoc({ minutesAgo: 25 * 60, severity: 'ERROR', source: 'server' }),
      logDoc({ minutesAgo: 3 * 24 * 60, severity: 'CRITICAL', source: 'web_client' }),
    ]
    await seedLogs([...not, ...want].reverse())
    expect(await read()).toEqual({ events: want.map(asRead) })
  })

  it('returns at most 50, the newest', async () => {
    const all = Array.from({ length: 60 }, (_, i) =>
      logDoc({ minutesAgo: i + 1, severity: 'ERROR', source: 'server', message: `e${i}` })
    )
    await seedLogs(all)
    const { events } = await read()
    expect(events.map((e) => e.message)).toEqual(all.slice(0, 50).map((d) => d.message))
  })

  it('answers with an empty list when nothing went wrong', async () => {
    await seedLogs([logDoc({ minutesAgo: 5, severity: 'INFO', source: 'web_client' })])
    expect(await read()).toEqual({ events: [] })
  })

  it('the defaults are the contract values', () => {
    expect([LOGS_READ_DEFAULT_LIMIT, LOGS_READ_DEFAULT_MINUTES]).toEqual([50, 1440])
  })
})

describe('L1-9 the session can find the tool', () => {
  it('is listed with its arguments', async () => {
    const tool = (await agent().tools()).find((t) => t.name === 'kanban_logs')
    expect(Object.keys(tool?.inputSchema.properties ?? {}).sort()).toEqual(
      ['limit', 'min_severity', 'request_id', 'since_minutes', 'source'].sort()
    )
  })

  it('the session instructions say to read kanban_logs before asking James to reproduce', () => {
    const steps = SESSION_INSTRUCTIONS.split(/\n\s*\n|\n(?=\s*\d+\.\s)/).map((c) =>
      c.replace(/\s+/g, ' ')
    )
    expect(steps.some((c) => c.includes('kanban_logs') && /reproduc/i.test(c))).toBe(true)
  })
})
