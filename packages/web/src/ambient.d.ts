// Declarations for modules TypeScript cannot see on its own.

// app.manifest.yaml, injected by the appManifest plugin in vite.config.ts.
declare module 'virtual:app-manifest' {
  const manifest: {
    app_id: string
    client_id: string | null
    audience_default: string
    log_endpoint: string | null
    env?: string
  }
  export default manifest
}

// The vendored governed browser logger is plain JS (logging/logger.browser.js; its one local
// change is the optional `transport`); this is its public surface, as documented at the top of that file.
declare module '*/logging/logger.browser.js' {
  import type { LoggerEvent } from '@kanban/shared'
  type LogContext = Record<string, string | number | boolean | null | undefined>
  export interface Logger {
    error(type: string, message: string, context?: LogContext): void
    warn(type: string, message: string, context?: LogContext): void
    info(type: string, message: string, context?: LogContext): void
    event(type: string, context?: LogContext): void
    critical(type: string, message: string, context?: LogContext): void
    debug(type: string, message: string, context?: LogContext): void
    flush(useBeacon?: boolean): Promise<void>
  }
  export function initLogger(options: {
    manifest: object
    taxonomy: object
    piiKeys: { strip: string[] }
    source: 'web_client' | 'scorm'
    env?: string
    userId?: string | null
    transport?: (events: LoggerEvent[]) => Promise<void>
  }): Logger
}
