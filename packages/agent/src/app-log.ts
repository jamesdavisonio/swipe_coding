// App logs on the agent side (docs/features/app-logs.md): `logFailure` stores a failure in the
// board's `logs` collection next to its stderr / agent.log line, and `readLogs` backs the
// kanban_logs tool. Logging never blocks or breaks the agent: nothing here rejects, and a failed
// store is reported on stderr only, never stored (so it can never recurse).
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Timestamp, type Query } from 'firebase-admin/firestore'
import { parse as parseYaml } from 'yaml'
import {
  AGENT_LOG_MAX_PER_MINUTE,
  LOGS_READ_DEFAULT_LIMIT,
  LOGS_READ_DEFAULT_MINUTES,
  LOGS_READ_MAX_LIMIT,
  LOGS_READ_MAX_MINUTES,
  LOGS_SCAN_MAX,
  LOG_RETENTION_MS,
  LOG_SEVERITIES,
  boundedLogFields,
  type LogSeverity,
} from '@kanban/shared'
import { boardStatus, getDb, log } from './firestore.ts'

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const LOGS = 'logs'
const MINUTE_MS = 60_000
const SCHEMA_VERSION = 1
const SOURCES = ['web_client', 'server'] as const
type Source = (typeof SOURCES)[number]

export interface FailureInput {
  severity: 'WARNING' | 'ERROR'
  event_type: 'api_call_failed' | 'feature_error'
  message: string
  context?: Record<string, string | number | boolean | null>
  request_id?: string
}

// ---- identity -------------------------------------------------------------------------------

interface AppIdentity {
  app_id: string
  client_id: string | null
  taxonomy_version: number
}
let identity: AppIdentity | null = null

// app.manifest.yaml and logging/taxonomy.json, read once, relative to this file.
function appIdentity(): AppIdentity {
  if (identity) return identity
  const manifest = parseYaml(readFileSync(join(REPO_ROOT, 'app.manifest.yaml'), 'utf8')) as {
    app_id: string
    client_id?: string | null
  }
  const taxonomy = JSON.parse(
    readFileSync(join(REPO_ROOT, 'logging', 'taxonomy.json'), 'utf8')
  ) as { taxonomy_version: number }
  identity = {
    app_id: manifest.app_id,
    client_id: manifest.client_id ?? null,
    taxonomy_version: taxonomy.taxonomy_version,
  }
  return identity
}

// Set by the board once registration completes; before that events carry no agent or project.
let registered: { agentId: string; projectId: string } | null = null
export function setLogIdentity(agentId: string, projectId: string): void {
  registered = { agentId, projectId }
}

// What an error says about itself: its `code` when it has one, else 'unknown'.
export function errorStatus(err: unknown): string | number {
  const code = (err as { code?: unknown }).code
  return typeof code === 'string' || typeof code === 'number' ? code : 'unknown'
}

// ---- storing --------------------------------------------------------------------------------

const storedAt: number[] = [] // Date.now() of each stored event inside the rolling minute

// Claims one slot of the per-minute budget, or says there is none left.
function claimSlot(now: number): boolean {
  while (storedAt.length > 0 && storedAt[0] <= now - MINUTE_MS) storedAt.shift()
  if (storedAt.length >= AGENT_LOG_MAX_PER_MINUTE) return false
  storedAt.push(now)
  return true
}

async function store(input: FailureInput, now: number): Promise<void> {
  const app = appIdentity()
  const fields = boundedLogFields({
    schema_version: SCHEMA_VERSION,
    taxonomy_version: app.taxonomy_version,
    timestamp: new Date(now).toISOString(),
    severity: input.severity,
    app_id: app.app_id,
    client_id: app.client_id,
    env: process.env.APP_ENV || 'prod',
    source: 'server',
    event_type: input.event_type,
    audience: 'internal',
    session_id: registered?.agentId ?? null,
    trace_id: null,
    user_id: null,
    message: input.message,
    context: {
      ...input.context,
      ...(registered ? { agent_id: registered.agentId, project_id: registered.projectId } : {}),
    },
  })
  await getDb()
    .collection(LOGS)
    .add({
      ...fields,
      expireAt: Timestamp.fromMillis(fields.ts + LOG_RETENTION_MS),
      request_id: input.request_id ?? `agent-${randomUUID()}`,
    })
}

export async function logFailure(input: FailureInput): Promise<void> {
  log(`${input.event_type} ${input.severity}: ${input.message}`)
  const now = Date.now()
  if (boardStatus().mode === 'offline' || !claimSlot(now)) return
  try {
    await store(input, now)
  } catch (err) {
    // Only a line on stderr: a log about failing to store a log must never be stored.
    log(`storing a log event failed: ${(err as Error).message}`)
  }
}

// ---- reading --------------------------------------------------------------------------------

export class InvalidLogArgError extends Error {
  constructor(name: string, why: string) {
    super(`invalid ${name}: ${why}`)
    this.name = 'InvalidLogArgError'
  }
}

interface ReadQuery {
  request_id?: string
  min_severity: LogSeverity
  since_minutes?: number
  source?: Source
  limit: number
}

const READ_ARGS = ['request_id', 'min_severity', 'since_minutes', 'source', 'limit']

function intArg(args: Record<string, unknown>, name: string, max: number): number | undefined {
  const v = args[name]
  if (v === undefined) return undefined
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 1 || v > max)
    throw new InvalidLogArgError(name, `an integer from 1 to ${max}`)
  return v
}

function parseReadArgs(args: Record<string, unknown>): ReadQuery {
  for (const name of Object.keys(args))
    if (!READ_ARGS.includes(name)) throw new InvalidLogArgError(name, 'unknown argument')
  const { request_id, min_severity, source } = args
  if (request_id !== undefined && (typeof request_id !== 'string' || request_id === ''))
    throw new InvalidLogArgError('request_id', 'a non-empty string')
  if (min_severity !== undefined && !LOG_SEVERITIES.includes(min_severity as LogSeverity))
    throw new InvalidLogArgError('min_severity', `one of ${LOG_SEVERITIES.join(', ')}`)
  if (source !== undefined && !SOURCES.includes(source as Source))
    throw new InvalidLogArgError('source', `one of ${SOURCES.join(', ')}`)
  return {
    request_id,
    min_severity: (min_severity as LogSeverity | undefined) ?? (request_id ? 'DEBUG' : 'WARNING'),
    since_minutes: intArg(args, 'since_minutes', LOGS_READ_MAX_MINUTES),
    source: source as Source | undefined,
    limit: intArg(args, 'limit', LOGS_READ_MAX_LIMIT) ?? LOGS_READ_DEFAULT_LIMIT,
  }
}

interface StoredLog {
  timestamp: string
  severity: string
  event_type: string
  source: string
  message: string
  request_id: string | null
  context: Record<string, unknown>
}

export async function readLogs(args: Record<string, unknown>) {
  const q = parseReadArgs(args)
  // A trail (a request id) has no time bound unless asked for; a search defaults to a day.
  const minutes = q.since_minutes ?? (q.request_id ? undefined : LOGS_READ_DEFAULT_MINUTES)
  let query: Query = getDb().collection(LOGS)
  if (q.request_id) query = query.where('request_id', '==', q.request_id)
  if (minutes !== undefined) query = query.where('ts', '>=', Date.now() - minutes * MINUTE_MS)
  // A trail reads oldest first, a search newest first.
  const snap = await query
    .orderBy('ts', q.request_id ? 'asc' : 'desc')
    .limit(LOGS_SCAN_MAX)
    .get()
  const floor = LOG_SEVERITIES.indexOf(q.min_severity)
  const events = snap.docs
    .map((d) => d.data() as StoredLog)
    .filter(
      (e) =>
        LOG_SEVERITIES.indexOf(e.severity as LogSeverity) >= floor &&
        (!q.source || e.source === q.source)
    )
    .slice(0, q.limit)
    .map((e) => ({
      time: e.timestamp,
      severity: e.severity,
      event_type: e.event_type,
      source: e.source,
      message: e.message,
      request_id: e.request_id,
      context: e.context,
    }))
  return { events }
}
