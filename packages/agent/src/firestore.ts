// Firebase Admin init for the desktop agent and hooks.
//
// Modes, decided once at import:
//   emulator        FIRESTORE_EMULATOR_HOST is set → no credentials needed
//   service_account KANBAN_SA, ../kanban-secrets/sa.json or %APPDATA%\kanban\sa.json → cert()
//                   never under the test runner (VITEST set): without the emulator the
//                   connection stays offline and no key is looked at, so a test can
//                   never reach the live board
//   offline         neither → the MCP server still starts so the session is not
//                   broken; every board tool returns a clear error instead.
//
// stdout is the MCP transport: never console.log in this package, use log().

import { readFileSync, appendFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { cert, getApps, initializeApp, type ServiceAccount } from 'firebase-admin/app'
import { getFirestore, type Firestore } from 'firebase-admin/firestore'

const here = dirname(fileURLToPath(import.meta.url))
export const pkgDir = join(here, '..')
const logFile = join(pkgDir, 'agent.log')
// agent.log is a convenience copy of stderr; if it cannot be written we say so once and
// keep going on stderr alone.
let logFileWritable = true

export function log(msg: string) {
  const line = `${new Date().toISOString()} [${process.pid}] ${msg}`
  console.error(line)
  if (!logFileWritable) return
  try {
    appendFileSync(logFile, line + '\n')
  } catch (err) {
    logFileWritable = false
    console.error(`agent.log not writable (${(err as Error).message}); logging to stderr only`)
  }
}

export type BoardMode = 'emulator' | 'service_account' | 'offline'

export class BoardOfflineError extends Error {
  constructor(detail: string) {
    super(`kanban board is offline: ${detail}`)
    this.name = 'BoardOfflineError'
  }
}

let db: Firestore | null = null
let mode: BoardMode = 'offline'
let detail = 'not initialised'

// Candidate key locations, first readable wins. The Claude desktop app is an MSIX
// package, and processes it starts see a virtualised %APPDATA%\Roaming (a file there
// is ENOENT from another context), so the canonical place is a sibling folder of this
// repo: `../kanban-secrets/sa.json` (outside git). %APPDATA% stays as a fallback.
function saCandidates(): string[] {
  const appData = process.env.APPDATA ?? join(process.env.HOME ?? '', '.config')
  return [
    process.env.KANBAN_SA,
    join(pkgDir, '..', '..', '..', 'kanban-secrets', 'sa.json'),
    join(appData, 'kanban', 'sa.json'),
  ].filter((p): p is string => !!p)
}

function findSa(): { path: string | null; tried: string[] } {
  const tried: string[] = []
  for (const p of saCandidates()) {
    try {
      statSync(p)
      return { path: p, tried }
    } catch (e) {
      tried.push(`${p} (${(e as NodeJS.ErrnoException).code ?? 'error'})`)
    }
  }
  return { path: null, tried }
}

function init() {
  try {
    if (process.env.FIRESTORE_EMULATOR_HOST) {
      const projectId = process.env.KANBAN_PROJECT_ID ?? 'demo-kanban'
      if (getApps().length === 0) initializeApp({ projectId })
      db = getFirestore()
      mode = 'emulator'
      detail = `${process.env.FIRESTORE_EMULATOR_HOST} project=${projectId}`
      return
    }
    if (process.env.VITEST) {
      detail =
        'the test runner never uses the live board; run through npm run test:rules (emulator)'
      return
    }
    const { path, tried } = findSa()
    if (!path) {
      detail = `no service account key; tried ${tried.join(', ')} (user=${process.env.USERNAME ?? '?'}); FIRESTORE_EMULATOR_HOST unset`
      return
    }
    const sa = JSON.parse(readFileSync(path, 'utf8')) as ServiceAccount & { project_id?: string }
    if (getApps().length === 0) initializeApp({ credential: cert(sa), projectId: sa.project_id })
    db = getFirestore()
    mode = 'service_account'
    detail = `project=${sa.project_id} via ${path}`
  } catch (err) {
    db = null
    mode = 'offline'
    detail = `init failed: ${(err as Error).message}`
  }
}

init()
log(`firestore mode=${mode} ${detail}`)

export function boardStatus(): { mode: BoardMode; detail: string } {
  return { mode, detail }
}

export function getDb(): Firestore {
  if (!db) throw new BoardOfflineError(detail)
  return db
}
