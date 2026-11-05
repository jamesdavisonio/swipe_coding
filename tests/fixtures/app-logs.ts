// Shared setup for the app-logs L1 unit suites (tests/app-logs-*.test.ts): the real vendored
// browser logger (logging/logger.browser.js) with the browser globals it touches stubbed, so a
// test can hand it a `transport`, hide the page, and see what reaches fetch or sendBeacon.
// Call vi.unstubAllGlobals() after each test.
import { vi } from 'vitest'
import { initLogger, type Logger } from '../../logging/logger.browser.js'
import taxonomy from '../../logging/taxonomy.json'
import piiKeys from '../../logging/pii-keys.json'

// app.manifest.yaml as the web build sees it (vite.config.ts adds env).
export const MANIFEST = {
  app_id: 'kanban',
  client_id: 'jamesdavisonio',
  audience_default: 'internal',
  log_endpoint: null as string | null,
  env: 'prod',
}

// One event as the logger builds it (logger.browser.js buildEvent).
export interface LogEvent {
  schema_version: number
  taxonomy_version: number
  timestamp: string
  severity: string
  app_id: string
  client_id: string | null
  env: string
  source: string
  event_type: string
  audience: string
  session_id: string
  trace_id: string | null
  user_id: string | null
  message: string
  context: Record<string, unknown>
}

export type Transport = (events: LogEvent[]) => Promise<void>

export interface TestLogger {
  log: Logger
  fetch: ReturnType<typeof vi.fn>
  sendBeacon: ReturnType<typeof vi.fn>
  hide: () => void // the page goes to the background (visibilitychange → hidden)
  pagehide: () => void // the page is closed
}

// A fresh logger. `transport` is passed only when given, so the no-transport path is today's.
export function browserLogger(
  opts: { transport?: Transport; endpoint?: string | null } = {}
): TestLogger {
  const handlers: Record<string, () => void> = {}
  const doc = { visibilityState: 'visible' }
  vi.stubGlobal('addEventListener', (type: string, fn: () => void) => {
    handlers[type] = fn
  })
  vi.stubGlobal('document', doc)
  const fetch = vi.fn(() => Promise.resolve(new Response(null, { status: 200 })))
  const sendBeacon = vi.fn(() => true)
  vi.stubGlobal('fetch', fetch)
  vi.stubGlobal('navigator', { sendBeacon })
  const options = {
    manifest: { ...MANIFEST, log_endpoint: opts.endpoint ?? null },
    taxonomy,
    piiKeys,
    source: 'web_client',
    ...(opts.transport ? { transport: opts.transport } : {}),
  } as Parameters<typeof initLogger>[0]
  return {
    log: initLogger(options),
    fetch,
    sendBeacon,
    hide: () => {
      doc.visibilityState = 'hidden'
      handlers.visibilitychange?.()
    },
    pagehide: () => handlers.pagehide?.(),
  }
}

// Every event handed to a transport spy, in call order.
export const handed = (transport: ReturnType<typeof vi.fn>): LogEvent[] =>
  transport.mock.calls.flatMap((c) => c[0] as LogEvent[])
