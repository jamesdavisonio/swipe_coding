// notifier 114/115 (the command line) in the Firestore emulator (`npm run test:rules`): the real
// `node packages/agent/src/notifier.ts` is started the way a logon task or `npm run notifier`
// starts it (emulator env, nothing else reachable). It takes the lease, handles a decision (writes
// notified), and a second one started while it runs writes "another notifier is running" to
// stderr and exits with code 1.
import { spawn, type ChildProcess } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { adminDb } from '../fixtures/app-logs-emulator.ts'
import {
  clearDevices,
  putTask,
  seedDevices,
  waitFor,
} from '../fixtures/board-briefs-b7-emulator.ts'

const ENTRY = join(import.meta.dirname, '..', '..', 'packages', 'agent', 'src', 'notifier.ts')
type Db = Awaited<ReturnType<typeof adminDb>>
let db: Db
const children: ChildProcess[] = []

interface Cli {
  child: ChildProcess
  stderr: () => string
  exited: Promise<number | null>
}
function runCli(): Cli {
  if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error('run through npm run test:rules')
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    KANBAN_PROJECT_ID: 'demo-kanban',
    KANBAN_SA: fileURLToPath(import.meta.url), // a file that is not a key
  }
  delete env.KANBAN_TEST_LIVE
  delete env.APP_ENV
  const child = spawn(process.execPath, [ENTRY], {
    env,
    cwd: mkdtempSync(join(tmpdir(), 'notifier-cli-')),
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  children.push(child)
  let err = ''
  child.stderr?.on('data', (d: Buffer) => (err += d.toString()))
  child.stdout?.resume()
  const exited = new Promise<number | null>((resolve) => child.once('exit', resolve))
  return { child, stderr: () => err, exited }
}
// A failed wait shows what the CLI printed to stderr by then.
async function withStderr<T>(cli: Cli, wait: () => Promise<T>): Promise<T> {
  try {
    return await wait()
  } catch (err) {
    throw new Error(`${(err as Error).message}; CLI stderr:\n${cli.stderr()}`)
  }
}
const lease = () => db.collection('notifier').doc('lease')

beforeAll(async () => {
  db = await adminDb()
  await lease().delete()
  await clearDevices(db)
})
afterAll(async () => {
  for (const c of children) c.kill()
  await Promise.all(
    children.map((c) => new Promise((r) => (c.exitCode === null ? c.once('exit', r) : r(null))))
  )
  await lease().delete()
  await clearDevices(db)
})

describe('notifier 114/115: the command line entry', () => {
  it('runs, holds the lease and handles a decision; a second one exits 1 saying another is running', async () => {
    await seedDevices(db, ['tok-cli']) // the emulator push sends nothing
    const first = runCli()
    await withStderr(first, () =>
      waitFor(
        async () => (await lease().get()).get('pid') === first.child.pid,
        "the lease to hold the CLI's pid",
        15_000
      )
    )
    const task = await putTask(db, { needs: { kind: 'question', question: 'From the CLI?' } })
    await withStderr(first, () =>
      waitFor(
        async () => (await db.collection('tasks').doc(task.id).get()).get('notified') as string,
        'the CLI to handle the decision',
        15_000
      )
    )

    const second = runCli()
    expect(await second.exited).toBe(1)
    expect(second.stderr()).toMatch(/another notifier is running/i)
    expect(first.child.exitCode).toBeNull() // the first is still running
    expect((await lease().get()).get('pid')).toBe(first.child.pid)
  }, 90_000)
})
