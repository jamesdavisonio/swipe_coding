// app-logs L1, criterion 11: kanban_logs honours min_severity, since_minutes, source and limit
// (at most 200), alone and with a request id; an invalid value or an unknown argument returns a
// tool error whose text starts `invalid <name>`. The real agent over stdio against the emulator
// (`npm run test:rules`); events are seeded with the admin db.
import { beforeEach, describe, expect, it } from 'vitest'
import { LOGS_READ_MAX_LIMIT, LOGS_READ_MAX_MINUTES } from '../../packages/shared/src/index.ts'
import { clearLogs, logDoc, seedLogs, useAgent } from '../fixtures/app-logs-emulator.ts'

const agent = useAgent('11')
const messages = async (args: Record<string, unknown>) =>
  (await agent().json<{ events: { message: string }[] }>('kanban_logs', args)).events.map(
    (e) => e.message
  )

// Newest first: minutes ago, severity, source, request id.
const SEED: [number, string, 'web_client' | 'server', string | null][] = [
  [1, 'DEBUG', 'web_client', 'r-11'],
  [2, 'INFO', 'server', 'r-11'],
  [10, 'WARNING', 'web_client', null],
  [20, 'ERROR', 'server', 'r-11'],
  [90, 'CRITICAL', 'web_client', 'r-11'],
  [180, 'ERROR', 'web_client', null],
  [2 * 24 * 60, 'ERROR', 'server', null],
]
const docs = () =>
  SEED.map(([minutesAgo, severity, source, request_id]) =>
    logDoc({ minutesAgo, severity, source, request_id, message: `${severity}@${minutesAgo}` })
  )

beforeEach(async () => {
  await clearLogs()
  await seedLogs(docs())
})

describe('L1-11 kanban_logs arguments', () => {
  it('min_severity', async () => {
    expect(await messages({ min_severity: 'ERROR' })).toEqual([
      'ERROR@20',
      'CRITICAL@90',
      'ERROR@180',
    ])
    expect(await messages({ min_severity: 'DEBUG' })).toEqual([
      'DEBUG@1',
      'INFO@2',
      'WARNING@10',
      'ERROR@20',
      'CRITICAL@90',
      'ERROR@180',
    ])
  })

  it('since_minutes', async () => {
    expect(await messages({ since_minutes: 60 })).toEqual(['WARNING@10', 'ERROR@20'])
    expect(await messages({ since_minutes: 3 * 24 * 60 })).toEqual([
      'WARNING@10',
      'ERROR@20',
      'CRITICAL@90',
      'ERROR@180',
      'ERROR@2880',
    ])
  })

  it('source', async () => {
    expect(await messages({ source: 'server' })).toEqual(['ERROR@20'])
    expect(await messages({ source: 'web_client' })).toEqual([
      'WARNING@10',
      'CRITICAL@90',
      'ERROR@180',
    ])
  })

  it('limit, up to 200', async () => {
    expect(await messages({ limit: 2 })).toEqual(['WARNING@10', 'ERROR@20'])
    expect(await messages({ limit: 200 })).toHaveLength(4)
  })

  it('all four together', async () => {
    expect(
      await messages({ min_severity: 'ERROR', since_minutes: 120, source: 'web_client', limit: 5 })
    ).toEqual(['CRITICAL@90'])
  })

  it('with a request id: source, min_severity, since_minutes and limit still apply', async () => {
    expect(await messages({ request_id: 'r-11' })).toEqual([
      'CRITICAL@90',
      'ERROR@20',
      'INFO@2',
      'DEBUG@1',
    ])
    expect(await messages({ request_id: 'r-11', source: 'web_client' })).toEqual([
      'CRITICAL@90',
      'DEBUG@1',
    ])
    expect(await messages({ request_id: 'r-11', min_severity: 'ERROR' })).toEqual([
      'CRITICAL@90',
      'ERROR@20',
    ])
    expect(await messages({ request_id: 'r-11', since_minutes: 60 })).toEqual([
      'ERROR@20',
      'INFO@2',
      'DEBUG@1',
    ])
    expect(await messages({ request_id: 'r-11', limit: 2 })).toEqual(['CRITICAL@90', 'ERROR@20'])
  })

  it('the bounds are the contract values', () => {
    expect([LOGS_READ_MAX_LIMIT, LOGS_READ_MAX_MINUTES]).toEqual([200, 43200])
  })

  const invalid: [string, Record<string, unknown>][] = [
    ['limit', { limit: 0 }],
    ['limit', { limit: 201 }],
    ['limit', { limit: 2.5 }],
    ['limit', { limit: '5' }],
    ['since_minutes', { since_minutes: 0 }],
    ['since_minutes', { since_minutes: 43_201 }],
    ['since_minutes', { since_minutes: 1.5 }],
    ['min_severity', { min_severity: 'NOTICE' }],
    ['min_severity', { min_severity: 'error' }],
    ['source', { source: 'scorm' }],
    ['request_id', { request_id: 42 }],
    ['severity', { severity: 'ERROR' }],
  ]
  for (const [name, args] of invalid)
    it(`refuses ${JSON.stringify(args)} naming ${name}`, async () => {
      const res = await agent().call('kanban_logs', args)
      expect(res.isError).toBe(true)
      expect(res.text.startsWith(`invalid ${name}`)).toBe(true)
    })
})
