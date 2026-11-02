/**
 * Shared browser/SCORM logger — the ONLY way client code logs.
 * In-memory buffer → batched POST to the ingestion endpoint (max every 10 s or
 * 20 events); `navigator.sendBeacon` on pagehide/visibilitychange; silent
 * failure with bounded retry; hard cap on queue size. Logging must NEVER
 * block, throw into, or slow the host application.
 *
 * Usage (vendored governed files imported or inlined at build time):
 *
 *   import { initLogger } from './logger.browser.js';
 *   import manifest from './app.manifest.json';   // generated from app.manifest.yaml
 *   import taxonomy from './taxonomy.json';
 *   import piiKeys from './pii-keys.json';
 *   const log = initLogger({ manifest, taxonomy, piiKeys, source: 'web_client' });
 *
 * `source` is set by the BUILD ENTRY that bundles this logger, never decided at
 * runtime: the app entry passes 'web_client'; the SCORM package build passes
 * 'scorm'. It must be one of the registry entry's sources[] — the ingestion
 * endpoint drops events claiming a source the app isn't registered for.
 *
 * API is identical to the server logger:
 *   log.error / log.warn / log.info / log.event / log.critical / log.debug
 */

const SCHEMA_VERSION = 1;
const FLUSH_INTERVAL_MS = 10_000;
const FLUSH_AT_COUNT = 20;
const QUEUE_HARD_CAP = 200;
const MAX_RETRIES = 3;
const USER_ACTION_SAMPLE_RATE = 0.1; // errors and milestones are always sent

const ALWAYS_SENT = new Set(['feature_error', 'api_call_failed', 'milestone_reached', 'session_start', 'session_end']);

export function initLogger({ manifest, taxonomy, piiKeys, source, env, userId = null }) {
  const resolvedEnv = env || manifest.env || 'prod';
  const isProd = resolvedEnv === 'prod';
  let resolvedSource = source;
  if (resolvedSource !== 'web_client' && resolvedSource !== 'scorm') {
    resolvedSource = 'web_client'; // never crash the host app over config
    if (!isProd && typeof console !== 'undefined') console.warn(`[logger] initLogger requires source: 'web_client' | 'scorm' (got ${JSON.stringify(source)}) — defaulting to 'web_client'`);
  }
  const strip = new Set(piiKeys.strip);
  const sessionId = (crypto.randomUUID && crypto.randomUUID()) || `s-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const sessionStartedAt = Date.now();

  let queue = [];
  let dropped = 0;
  let flushTimer = null;
  let sessionEnded = false;

  function warnDev(message) {
    if (!isProd && typeof console !== 'undefined') console.warn(`[logger] ${message}`);
  }

  function sanitizeContext(context) {
    const clean = {};
    for (const [key, value] of Object.entries(context || {})) {
      if (strip.has(key.toLowerCase())) { warnDev(`context.${key} is PII — stripped`); continue; }
      clean[key] = value !== null && typeof value === 'object' ? JSON.stringify(value) : value;
    }
    return clean;
  }

  function buildEvent(severity, eventType, message, context) {
    const { _audience, ...rest } = context || {};
    if (!taxonomy.event_types[eventType]) {
      warnDev(`unknown event_type "${eventType}" — apply rule R3 (unclassified + proposed_type). The endpoint will rewrite it.`);
    }
    return {
      schema_version: SCHEMA_VERSION,
      taxonomy_version: taxonomy.taxonomy_version,
      timestamp: new Date().toISOString(),
      severity,
      app_id: manifest.app_id,
      client_id: manifest.client_id ?? null,
      env: resolvedEnv,
      source: resolvedSource,
      event_type: eventType,
      audience: _audience || manifest.audience_default || 'internal',
      session_id: sessionId,
      trace_id: null,
      user_id: userId, // hashed upstream — NEVER raw PII
      message: String(message || ''),
      context: sanitizeContext(rest),
    };
  }

  function enqueue(severity, eventType, message, context) {
    try {
      if (severity === 'DEBUG' && isProd) return;
      // Volume guard: fine-grained interactions are sampled; errors/milestones always sent.
      if (eventType === 'user_action' && severity === 'INFO' && Math.random() > USER_ACTION_SAMPLE_RATE) return;
      if (queue.length >= QUEUE_HARD_CAP) {
        if (!ALWAYS_SENT.has(eventType) && severity !== 'ERROR' && severity !== 'CRITICAL') { dropped += 1; return; }
        queue.shift(); // make room for an always-sent event by dropping the oldest
        dropped += 1;
      }
      queue.push(buildEvent(severity, eventType, message, context));
      if (queue.length >= FLUSH_AT_COUNT) flush();
      else if (!flushTimer) flushTimer = setTimeout(flush, FLUSH_INTERVAL_MS);
    } catch (_) { /* logging never throws into the host app */ }
  }

  async function flush(useBeacon = false) {
    try {
      if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
      if (!queue.length || !manifest.log_endpoint) return;
      const batch = queue;
      queue = [];
      if (dropped > 0) {
        batch.push(buildEvent('WARNING', 'unclassified', `${dropped} events dropped by queue cap`, { proposed_type: 'log_events_dropped', dropped_count: dropped }));
        dropped = 0;
      }
      const body = JSON.stringify({ events: batch });
      if (useBeacon && navigator.sendBeacon) {
        navigator.sendBeacon(manifest.log_endpoint, new Blob([body], { type: 'application/json' }));
        return;
      }
      for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
        try {
          const res = await fetch(manifest.log_endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true });
          if (res.ok) return;
        } catch (_) { /* retry below */ }
        await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
      }
      // Bounded retry exhausted: drop the batch silently — never disturb the host app.
    } catch (_) { /* never throw */ }
  }

  function endSession() {
    if (sessionEnded) return;
    sessionEnded = true;
    enqueue('INFO', 'session_end', 'session ended', { duration_s: Math.round((Date.now() - sessionStartedAt) / 1000) });
    flush(true);
  }

  if (typeof addEventListener === 'function') {
    addEventListener('pagehide', endSession);
    addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(true); });
  }

  const log = {
    error: (type, message, context) => enqueue('ERROR', type, message, context),
    warn: (type, message, context) => enqueue('WARNING', type, message, context),
    info: (type, message, context) => enqueue('INFO', type, message, context),
    event: (type, context) => enqueue('INFO', type, type, context),
    critical: (type, message, context) => enqueue('CRITICAL', type, message, context),
    debug: (type, message, context) => enqueue('DEBUG', type, message, context),
    flush,
  };

  log.info('session_start', 'session started', {});
  return log;
}
