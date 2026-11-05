// app-logs L1, criterion 10: kanban_logs with a request id returns every stored event with that
// id, of any severity and from either source, oldest first, with no time bound: the trail of one
// operation, from the phone and from the agent. The real agent over stdio against the emulator
// (`npm run test:rules`); events are seeded with the admin db.
import { beforeEach, describe, expect, it } from 'vitest'
import { asRead, clearLogs, logDoc, seedLogs, useAgent } from '../fixtures/app-logs-emulator.ts'

const agent = useAgent('10')
const read = (args: Record<string, unknown>) =>
  agent().json<{ events: ReturnType<typeof asRead>[] }>('kanban_logs', args)

beforeEach(() => clearLogs())

describe('L1-10 kanban_logs with a request id', () => {
  it('returns the whole trail of that operation, oldest first', async () => {
    const trail = [
      logDoc({
        minutesAgo: 3 * 24 * 60,
        severity: 'DEBUG',
        source: 'web_client',
        request_id: 'r-10',
      }),
      logDoc({ minutesAgo: 90, severity: 'INFO', source: 'web_client', request_id: 'r-10' }),
      logDoc({ minutesAgo: 89, severity: 'ERROR', source: 'server', request_id: 'r-10' }),
      logDoc({ minutesAgo: 1, severity: 'WARNING', source: 'web_client', request_id: 'r-10' }),
    ]
    const others = [
      logDoc({ minutesAgo: 2, severity: 'ERROR', source: 'server', request_id: 'r-other' }),
      logDoc({ minutesAgo: 5, severity: 'CRITICAL', source: 'web_client', request_id: null }),
    ]
    await seedLogs([...trail, ...others].reverse())
    expect(await read({ request_id: 'r-10' })).toEqual({ events: trail.map(asRead) })
  })

  it('returns nothing for an id nobody logged', async () => {
    await seedLogs([
      logDoc({ minutesAgo: 1, severity: 'ERROR', source: 'server', request_id: 'r-x' }),
    ])
    expect(await read({ request_id: 'r-unknown' })).toEqual({ events: [] })
  })
})
