/**
 * Shared server logger — the ONLY way server code logs.
 * One JSON line per event to stdout; Cloud Logging parses it as jsonPayload
 * and maps `severity` natively. No network calls, no dependencies.
 *
 * Expects, in the same directory: taxonomy.json, context-keys.json,
 * pii-keys.json (vendored from the skills repo) and app.manifest.yaml at the
 * app root (generated from registry.json at setup). Do not edit the vendored
 * files by hand — re-vendor from the skills repo.
 *
 * API (identical on server and browser):
 *   log.error(eventType, message, context?)     // ERROR
 *   log.warn(eventType, message, context?)      // WARNING
 *   log.info(eventType, message, context?)      // INFO
 *   log.event(eventType, context?)              // sugar: business event, INFO
 *   log.critical(eventType, message, context?)  // CRITICAL
 *   log.debug(eventType, message, context?)     // DEBUG — dropped in prod
 *   log.withTrace(traceId)                      // bound logger for one request
 */
'use strict';

const fs = require('fs');
const path = require('path');

const SCHEMA_VERSION = 1;
const MANIFEST_PATH = process.env.APP_MANIFEST_PATH || path.join(process.cwd(), 'app.manifest.yaml');

// The manifest is flat key: value YAML by contract — no YAML dependency needed.
function parseFlatYaml(raw) {
  const out = {};
  for (const line of raw.split('\n')) {
    const match = line.match(/^([A-Za-z0-9_]+):\s*(.*?)\s*(#.*)?$/);
    if (!match) continue;
    let value = match[2].replace(/^["']|["']$/g, '');
    if (value === 'null' || value === '') value = null;
    else if (/^-?\d+$/.test(value)) value = Number(value);
    out[match[1]] = value;
  }
  return out;
}

function loadLocal(file) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, file), 'utf8'));
}

const manifest = parseFlatYaml(fs.readFileSync(MANIFEST_PATH, 'utf8'));
const taxonomy = loadLocal('taxonomy.json');
const piiKeys = new Set(loadLocal('pii-keys.json').strip);
const contextKeys = loadLocal('context-keys.json').keys;

const env = process.env[manifest.env_var || 'APP_ENV'] || 'dev';
const isProd = env === 'prod';

// Validation is advisory: warn in dev, pass through in prod — never crash the app.
function warnDev(message) {
  if (!isProd) process.stderr.write(`[logger] ${message}\n`);
}

function validate(eventType, context) {
  const entry = taxonomy.event_types[eventType];
  if (!entry) {
    warnDev(`unknown event_type "${eventType}" — not in taxonomy.json v${taxonomy.taxonomy_version}. Apply rule R3: use "unclassified" + context.proposed_type.`);
    return;
  }
  for (const key of entry.required_context) {
    if (!(key in context)) warnDev(`event_type "${eventType}" requires context.${key} (${contextKeys[key] || 'see context-keys.json'})`);
  }
}

function sanitizeContext(context) {
  const clean = {};
  for (const [key, value] of Object.entries(context)) {
    if (piiKeys.has(key.toLowerCase())) {
      warnDev(`context.${key} is on the PII denylist — stripped. Do not log PII.`);
      continue;
    }
    if (value !== null && typeof value === 'object') {
      warnDev(`context.${key} is not a primitive — context must be flat. Stringified.`);
      clean[key] = JSON.stringify(value);
      continue;
    }
    clean[key] = value;
  }
  return clean;
}

function emit(severity, eventType, message, context, traceId) {
  try {
    if (severity === 'DEBUG' && isProd) return;
    const { _audience, user_id, ...rest } = context || {};
    validate(eventType, rest);
    const event = {
      schema_version: SCHEMA_VERSION,
      taxonomy_version: taxonomy.taxonomy_version,
      timestamp: new Date().toISOString(),
      severity,
      app_id: manifest.app_id,
      client_id: manifest.client_id,
      env,
      source: 'server', // the transport IS the source: stdout only exists on the server
      event_type: eventType,
      audience: _audience || manifest.audience_default || 'internal',
      session_id: null,
      trace_id: traceId || null,
      user_id: user_id || null, // caller-provided, hashed upstream — NEVER raw PII
      message: String(message || ''),
      context: sanitizeContext(rest),
    };
    process.stdout.write(JSON.stringify(event) + '\n');
  } catch (err) {
    // Logging must never throw into the application.
    try { process.stderr.write(`[logger] emit failed: ${err.message}\n`); } catch (_) { /* last resort: drop */ }
  }
}

function makeLogger(traceId) {
  return {
    error: (type, message, context) => emit('ERROR', type, message, context, traceId),
    warn: (type, message, context) => emit('WARNING', type, message, context, traceId),
    info: (type, message, context) => emit('INFO', type, message, context, traceId),
    event: (type, context) => emit('INFO', type, type, context, traceId),
    critical: (type, message, context) => emit('CRITICAL', type, message, context, traceId),
    debug: (type, message, context) => emit('DEBUG', type, message, context, traceId),
    withTrace: (id) => makeLogger(id),
  };
}

module.exports = { log: makeLogger(null) };
