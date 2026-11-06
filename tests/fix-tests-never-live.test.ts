// Repro for the live-key leak (fix/tests-never-live). On 2026-11-06 a test run without the
// Firestore emulator seeded 44 documents on the live board: the agent's board connection
// (packages/agent/src/firestore.ts) falls back to a service-account key whenever
// FIRESTORE_EMULATOR_HOST is unset, and test fixtures that open it directly (getDb, Board) had no
// guard of their own. Under the test runner (VITEST set; every process a test starts inherits it)
// the connection must refuse every key, without even looking at one, and stay offline; the
// emulator still works; outside the test runner nothing changes.
//
// Safety: no real key or project is involved. Each case runs firestore.ts in a child process
// under Node's permission model with file reads limited to this repo and a temp folder, so the
// real key in ..\kanban-secrets (and %APPDATA%) can never be read, even by a wrong fix. The keys
// the cases offer are throwaway service accounts (a freshly generated RSA key, project
// `not-a-real-project`); initialising the Admin SDK makes no network call. A preload records
// every file-system call on the temp folder, which is how "no key file is read" is observed.
// Runs with `npm test` (no emulator).
import { execFileSync } from 'node:child_process'
import { generateKeyPairSync } from 'node:crypto'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'

const ROOT = join(import.meta.dirname, '..')
const FIRESTORE_TS = join(ROOT, 'packages', 'agent', 'src', 'firestore.ts')

// Records file-system calls on paths under KEY_DIR, then re-syncs the ESM bindings so
// firestore.ts's `import { statSync, readFileSync } from 'node:fs'` sees the wrappers.
const PRELOAD = `
import fs from 'node:fs'
import { syncBuiltinESMExports } from 'node:module'
globalThis.__keyTouches = []
const dir = process.env.KEY_DIR.toLowerCase()
for (const name of ['statSync', 'readFileSync', 'existsSync', 'accessSync', 'openSync', 'lstatSync']) {
  const real = fs[name]
  fs[name] = function (p, ...rest) {
    if (String(p).toLowerCase().startsWith(dir)) globalThis.__keyTouches.push(name + ' ' + p)
    return real.call(this, p, ...rest)
  }
}
syncBuiltinESMExports()
`

let keyDir = ''
afterEach(() => {
  if (keyDir) rmSync(keyDir, { recursive: true, force: true })
  keyDir = ''
})

// A temp folder holding the preload and a throwaway service-account key at `rel`.
function throwawayKey(rel = 'sa.json'): string {
  keyDir = mkdtempSync(join(tmpdir(), 'tests-never-live-'))
  writeFileSync(join(keyDir, 'preload.mjs'), PRELOAD)
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
  const file = join(keyDir, rel)
  mkdirSync(join(file, '..'), { recursive: true })
  writeFileSync(
    file,
    JSON.stringify({
      type: 'service_account',
      project_id: 'not-a-real-project',
      private_key_id: 'throwaway',
      private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }),
      client_email: 'throwaway@not-a-real-project.iam.gserviceaccount.com',
      client_id: '0',
    })
  )
  return file
}

interface Status {
  mode: string
  detail: string
  err: string | null
  touches: string[]
}

// What a fresh, sandboxed process reports when it loads firestore.ts with `env`.
function statusIn(env: NodeJS.ProcessEnv): Status {
  const script =
    `const m = await import(${JSON.stringify(pathToFileURL(FIRESTORE_TS).href)});` +
    `let err = null; try { m.getDb() } catch (e) { err = e.message }` +
    `process.stdout.write(JSON.stringify({ ...m.boardStatus(), err, touches: globalThis.__keyTouches }))`
  const out = execFileSync(
    process.execPath,
    [
      '--permission',
      `--allow-fs-read=${ROOT}`,
      `--allow-fs-read=${keyDir}`,
      '--import',
      pathToFileURL(join(keyDir, 'preload.mjs')).href,
      '--input-type=module',
      '-e',
      script,
    ],
    { env: { ...env, KEY_DIR: keyDir }, encoding: 'utf8' }
  )
  return JSON.parse(out) as Status
}

// The test runner's environment (VITEST and the rest, as a test's child gets it) with no
// emulator and no live switch.
function runnerEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env }
  delete env.FIRESTORE_EMULATOR_HOST
  delete env.KANBAN_TEST_LIVE
  delete env.KANBAN_SA
  return env
}
const withoutVitest = (env: NodeJS.ProcessEnv) => {
  for (const k of Object.keys(env)) if (k.startsWith('VITEST')) delete env[k]
  return env
}
const offlineForTests = (s: Status) => {
  expect(s.mode).toBe('offline')
  expect(s.detail).toContain('npm run test:rules')
  expect(s.err).toContain('kanban board is offline')
  expect(s.touches).toEqual([]) // no key file was even looked at
}

describe('the board connection never uses a key under the test runner', () => {
  it('runs under the test runner (precondition)', () => {
    expect(process.env.VITEST).toBeTruthy()
  })

  it('a key named by KANBAN_SA is refused, unread, and the board stays offline', () => {
    offlineForTests(statusIn({ ...runnerEnv(), KANBAN_SA: throwawayKey() }))
  })

  it('a key at a default location (%APPDATA%\\kanban\\sa.json) is refused, unread', () => {
    throwawayKey(join('kanban', 'sa.json'))
    offlineForTests(statusIn({ ...runnerEnv(), APPDATA: keyDir }))
  })

  it('VITEST alone, as in the runner main process, is enough', () => {
    const env = withoutVitest({ ...runnerEnv(), KANBAN_SA: throwawayKey() })
    offlineForTests(statusIn({ ...env, VITEST: 'true' }))
  })

  it('the emulator still works under the test runner', () => {
    const s = statusIn({
      ...runnerEnv(),
      KANBAN_SA: throwawayKey(),
      FIRESTORE_EMULATOR_HOST: '127.0.0.1:1',
      KANBAN_PROJECT_ID: 'demo-kanban',
    })
    expect(s.mode).toBe('emulator')
    expect(s.detail).toContain('127.0.0.1:1')
    expect(s.detail).toContain('project=demo-kanban')
    expect(s.err).toBeNull()
  })

  it('outside the test runner the same key is used as before (sessions unaffected)', () => {
    const s = statusIn(withoutVitest({ ...runnerEnv(), KANBAN_SA: throwawayKey() }))
    expect(s.mode).toBe('service_account')
    expect(s.detail).toContain('not-a-real-project')
    expect(s.err).toBeNull()
  })
})
