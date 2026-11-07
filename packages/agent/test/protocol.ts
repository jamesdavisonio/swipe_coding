// Drives the agent over stdio the way Claude Code does.
//
// Always:   initialize advertises claude/channel + instructions; tools/list is complete.
// Emulator: (FIRESTORE_EMULATOR_HOST set) create a task, write a james comment with the
//           Admin SDK, run the watcher command the task result gives (ADR 0005): it prints
//           the reply and marks it delivered, and no channel event carries it; then
//           kanban_ask → task needs a question → answer through the watcher → needs cleared.
import { exec, spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { ServiceAccount } from 'firebase-admin/app'

// The slices of JSON-RPC traffic this test inspects.
interface RpcMessage {
  jsonrpc: '2.0'
  id?: number
  method?: string
  params?: {
    content?: string
    meta?: { id?: string; from?: string; task?: string; kind?: string }
  }
  result?: {
    capabilities?: { experimental?: Record<string, unknown>; tools?: unknown }
    instructions?: string
    tools?: {
      name: string
      inputSchema?: { properties?: Record<string, { type?: string; items?: { type?: string } }> }
    }[]
    isError?: boolean
    content?: { type: string; text: string }[]
  }
  error?: unknown
}
// What the tools return (see taskBrief / kanban_whoami in src/index.ts).
interface TaskBrief {
  id: string
  type: string
  stage: string
  needs: { kind: string; question?: string } | null
  mine?: boolean
  watcher?: string
  suggestions?: { id: string; text: string }[]
  retired?: string[]
  refused?: { id: string; reason: string }[]
}
interface Whoami {
  cwd: string
  projectId: string
  agentId: string
  board?: { mode: string }
}

const here = dirname(fileURLToPath(import.meta.url))
const entry = join(here, '..', 'src', 'index.ts')
const emulator = process.env.FIRESTORE_EMULATOR_HOST
// KANBAN_TEST_LIVE=1 runs the board checks against the real project using the
// service-account key (same resolution as the agent); test data is cleaned up after.
const live = process.env.KANBAN_TEST_LIVE === '1'
const withBoard = !!emulator || live
const saPath =
  process.env.KANBAN_SA ?? join(here, '..', '..', '..', '..', 'kanban-secrets', 'sa.json')
const projectId = process.env.KANBAN_PROJECT_ID ?? 'demo-kanban'

const env: NodeJS.ProcessEnv = { ...process.env, KANBAN_PROJECT_ID: projectId }
if (!withBoard) {
  // Force offline mode even if a real service account is configured on this machine: point
  // KANBAN_SA at a file that exists but is not a key (this test), so the agent's init fails
  // before it can fall through to any real key on disk.
  delete env.FIRESTORE_EMULATOR_HOST
  env.KANBAN_SA = fileURLToPath(import.meta.url)
}

// Run from the repo root so the project the agent registers is the real one, not packages/agent.
const child = spawn(process.execPath, [entry], {
  env,
  cwd: join(here, '..', '..', '..'),
  stdio: ['pipe', 'pipe', 'pipe'],
})
child.stderr.on('data', (d) => process.stderr.write(`  [agent] ${d}`))

const inbox: RpcMessage[] = []
let buf = ''
child.stdout.on('data', (d: Buffer) => {
  buf += d.toString()
  let i
  while ((i = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, i).trim()
    buf = buf.slice(i + 1)
    if (line) inbox.push(JSON.parse(line) as RpcMessage)
  }
})

let nextId = 1
function send(method: string, params: Record<string, unknown> = {}, notify = false) {
  const id = notify ? undefined : nextId++
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n')
  return id
}
async function waitFor(
  pred: (m: RpcMessage) => boolean,
  what: string,
  ms = 5000
): Promise<RpcMessage> {
  const t0 = Date.now()
  while (Date.now() - t0 < ms) {
    const m = inbox.find(pred)
    if (m) return m
    await new Promise((r) => setTimeout(r, 25))
  }
  throw new Error(`timeout waiting for ${what}; inbox=${JSON.stringify(inbox).slice(0, 2000)}`)
}
async function call<T = unknown>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  const id = send('tools/call', { name, arguments: args })
  const res = await waitFor((m) => m.id === id, `tools/call ${name}`)
  if (res.error) throw new Error(`${name} rpc error: ${JSON.stringify(res.error)}`)
  const text = res.result?.content?.[0]?.text ?? ''
  if (res.result?.isError) throw new Error(`${name} tool error: ${text}`)
  return JSON.parse(text) as T
}
function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`)
  console.log(`ok - ${msg}`)
}

const EXPECTED_TOOLS = [
  'kanban_list_tasks',
  'kanban_get_task',
  'kanban_create_task',
  'kanban_start_task',
  'kanban_update_task',
  'kanban_subtask',
  'kanban_comment',
  'kanban_ask',
  'kanban_todo_for_james',
  'kanban_whoami',
  'kanban_answered_in_session',
]

// Runs the watcher command exactly as given (through the shell, like a session would) and
// returns the reply lines it printed; it must exit 0 within 15 s.
function runWatcher(command: string): Promise<{ id: string; kind: string; text: string }[]> {
  return new Promise((resolve, reject) => {
    exec(command, { env, timeout: 15_000 }, (err, stdout, stderr) => {
      if (err) reject(new Error(`watcher failed: ${err.message}\n${stderr.slice(-1000)}`))
      else
        resolve(
          stdout
            .trim()
            .split('\n')
            .filter(Boolean)
            .map((l) => JSON.parse(l) as { id: string; kind: string; text: string })
        )
    })
  })
}
const jamesChannel = (m: RpcMessage) =>
  m.method === 'notifications/claude/channel' && m.params?.meta?.from === 'james'

try {
  const initId = send('initialize', {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: { name: 'protocol-test', version: '0' },
  })
  const init = await waitFor((m) => m.id === initId, 'initialize result')
  assert(
    init.result?.capabilities?.experimental?.['claude/channel'],
    'initialize advertises claude/channel'
  )
  assert(init.result?.capabilities?.tools, 'initialize advertises tools')
  assert(/watcher/.test(init.result?.instructions ?? ''), 'instructions explain the watcher')
  assert(/kanban_ask/.test(init.result?.instructions ?? ''), 'instructions describe the workflow')
  send('notifications/initialized', {}, true)

  const listId = send('tools/list')
  const list = await waitFor((m) => m.id === listId, 'tools/list result')
  const names = list.result?.tools?.map((t) => t.name) ?? []
  const missing = EXPECTED_TOOLS.filter((n) => !names.includes(n))
  assert(
    missing.length === 0,
    `all ${EXPECTED_TOOLS.length} tools listed${missing.length ? ` (missing ${missing.join(', ')})` : ''}`
  )

  const retireProp = list.result?.tools?.find((t) => t.name === 'kanban_update_task')?.inputSchema
    ?.properties?.retire_suggestions
  assert(
    retireProp?.type === 'array' && retireProp.items?.type === 'string',
    'kanban_update_task inputSchema has retire_suggestions: string[]'
  )

  const askOptions = list.result?.tools?.find((t) => t.name === 'kanban_ask')?.inputSchema
    ?.properties?.options
  assert(
    names.length === 12 && askOptions?.type === 'array' && askOptions.items?.type === 'string',
    'kanban_ask inputSchema has options: string[] (12 tools)'
  )

  const who = await call<Whoami>('kanban_whoami')
  assert(
    typeof who.cwd === 'string' && who.board?.mode,
    `whoami works (board ${who.board?.mode ?? 'none'})`
  )

  if (!withBoard) {
    const offId = send('tools/call', { name: 'kanban_list_tasks', arguments: {} })
    const r = await waitFor((m) => m.id === offId, 'offline list')
    assert(
      r.result?.isError && /offline/.test(r.result.content?.[0]?.text ?? ''),
      'board tools report offline cleanly'
    )
    console.log('skipped Firestore checks (no emulator)')
  } else {
    const { initializeApp, getApps } = await import('firebase-admin/app')
    const { getFirestore } = await import('firebase-admin/firestore')
    if (getApps().length === 0) {
      if (live) {
        const { cert } = await import('firebase-admin/app')
        const { readFileSync } = await import('node:fs')
        const sa = JSON.parse(readFileSync(saPath, 'utf8')) as ServiceAccount & {
          project_id?: string
        }
        initializeApp({ credential: cert(sa), projectId: sa.project_id })
      } else {
        initializeApp({ projectId })
      }
    }
    const db = getFirestore()

    const task = await call<TaskBrief>('kanban_create_task', {
      title: 'Protocol test task',
      type: 'feature',
      description: 'created by test',
    })
    assert(
      task.id && task.stage === 'spec' && task.needs === null && task.mine === true,
      `create_task → ${task.id}`
    )

    const listed = await call<TaskBrief[]>('kanban_list_tasks')
    assert(
      listed.some((t) => t.id === task.id) && listed[0]?.type === 'for_james',
      'list_tasks shows it, For James pinned first'
    )

    // Retiring suggestions (swipe-deck 65, 66): two finished tasks with a Suggested next list.
    const seedDone = async (retiredNext: number[]) => {
      const seeded = await call<TaskBrief>('kanban_create_task', {
        title: 'Protocol retire seed',
        type: 'chore',
      })
      await db
        .collection('tasks')
        .doc(seeded.id)
        .update({
          stage: 'done',
          needs: null,
          agentId: null,
          doneAt: Date.now() - 60_000,
          summary: 'Done.\n\n### Suggested next\nAlpha - a\nBeta - b\nGamma - c',
          retiredNext,
        })
      return seeded.id
    }
    const partial = await seedDone([1])
    const allRetired = await seedDone([0, 1, 2])
    const withSuggestions = await call<TaskBrief[]>('kanban_list_tasks')
    const byId = (id: string) => withSuggestions.find((t) => t.id === id)
    assert(
      JSON.stringify(byId(partial)?.suggestions) ===
        JSON.stringify([
          { id: `${partial}:0`, text: 'Alpha - a' },
          { id: `${partial}:2`, text: 'Gamma - c' },
        ]),
      'list_tasks: a done task lists its open suggestions, retired index left out'
    )
    assert(
      byId(allRetired) !== undefined && !('suggestions' in byId(allRetired)!),
      'list_tasks: an all-retired done task has no suggestions field'
    )
    assert(
      byId(task.id) !== undefined && !('suggestions' in byId(task.id)!),
      'list_tasks: an open task has no suggestions field'
    )

    const retire = await call<TaskBrief>('kanban_update_task', {
      task_id: task.id,
      retire_suggestions: [`${partial}:0`, 'junk'],
    })
    assert(
      retire.id === task.id &&
        JSON.stringify(retire.retired) === JSON.stringify([`${partial}:0`]) &&
        retire.refused?.length === 1 &&
        retire.refused[0].id === 'junk' &&
        retire.refused[0].reason.length > 0,
      'update_task retire_suggestions replies with the brief, retired and refused'
    )
    const plain = await call<TaskBrief>('kanban_update_task', {
      task_id: task.id,
      title: 'Protocol test task',
    })
    assert(
      plain.id === task.id && !('retired' in plain) && !('refused' in plain),
      'update_task without retire_suggestions has no retired or refused'
    )
    for (const id of [partial, allRetired]) {
      const cleanup = db.batch()
      for (const d of (await db.collection('comments').where('taskId', '==', id).get()).docs)
        cleanup.delete(d.ref)
      cleanup.delete(db.collection('tasks').doc(id))
      await cleanup.commit()
    }

    const t0 = Date.now()
    const cRef = db.collection('comments').doc()
    await cRef.set({
      taskId: task.id,
      projectId: who.projectId,
      agentId: who.agentId,
      author: 'james',
      kind: 'comment',
      body: 'Looks good, carry on.',
      createdAt: t0,
      deliveredAt: null,
    })
    assert(typeof task.watcher === 'string', `create_task gives the watcher command`)
    assert((await cRef.get()).get('deliveredAt') == null, 'reply waits undelivered for a watcher')
    const lines = await runWatcher(task.watcher!)
    assert(
      lines.length === 1 &&
        lines[0].id === cRef.id &&
        lines[0].kind === 'comment' &&
        lines[0].text === 'Looks good, carry on.',
      `watcher printed the reply in ${Date.now() - t0} ms`
    )
    assert((await cRef.get()).get('deliveredAt') != null, 'deliveredAt set once printed')
    assert(!inbox.some(jamesChannel), 'no channel event carries the reply')

    await call('kanban_subtask', { task_id: task.id, key: 'spec', status: 'awaiting_approval' })
    let snap = await db.collection('tasks').doc(task.id).get()
    assert(
      (snap.get('needs') as TaskBrief['needs'])?.kind === 'spec',
      'subtask spec awaiting_approval → needs spec'
    )
    await call('kanban_ask', { task_id: task.id, question: 'Approve the spec?' })
    snap = await db.collection('tasks').doc(task.id).get()
    assert(
      (snap.get('needs') as TaskBrief['needs'])?.kind === 'question' &&
        (snap.get('needs') as TaskBrief['needs'])?.question === 'Approve the spec?',
      'ask → needs question'
    )

    const aRef = db.collection('comments').doc()
    await aRef.set({
      taskId: task.id,
      projectId: who.projectId,
      agentId: who.agentId,
      author: 'james',
      kind: 'answer',
      body: 'Approved.',
      createdAt: Date.now(),
      deliveredAt: null,
    })
    const answered = await runWatcher(task.watcher!)
    assert(
      answered.length === 1 && answered[0].id === aRef.id && answered[0].kind === 'answer',
      'watcher printed the answer'
    )
    snap = await db.collection('tasks').doc(task.id).get()
    assert(snap.get('needs') === null, 'answer → needs cleared')
    assert(!inbox.some(jamesChannel), 'no channel event carries the answer')

    await call('kanban_subtask', { task_id: task.id, key: 'spec', status: 'done' })
    snap = await db.collection('tasks').doc(task.id).get()
    assert(
      snap.get('stage') === 'approved',
      `subtask spec done → stage ${String(snap.get('stage'))}`
    )
    await call('kanban_subtask', { task_id: task.id, key: 'approved', status: 'done' })
    snap = await db.collection('tasks').doc(task.id).get()
    assert(
      snap.get('stage') === 'build',
      `subtask approved done → stage ${String(snap.get('stage'))}`
    )

    await call('kanban_ask', {
      task_id: task.id,
      question: 'Which route?',
      options: [' Fast ', 'Safe'],
    })
    snap = await db.collection('tasks').doc(task.id).get()
    const askedNeed = snap.get('needs') as {
      kind?: string
      question?: string
      options?: { key: string; label: string }[]
    } | null
    assert(
      askedNeed?.kind === 'question' &&
        askedNeed.question === 'Which route?' &&
        JSON.stringify(askedNeed.options) ===
          JSON.stringify([
            { key: 'a', label: 'Fast' },
            { key: 'b', label: 'Safe' },
          ]),
      'ask with options → needs question with keyed options'
    )

    await call('kanban_ask', { task_id: task.id, question: 'Which option?' })
    await call('kanban_update_task', { task_id: task.id, status: 'in_progress' })
    snap = await db.collection('tasks').doc(task.id).get()
    assert(snap.get('needs') === null, 'update_task in_progress after ask → needs null')

    const todo = await call<{ id: string }>('kanban_todo_for_james', {
      body: 'Merge the PR',
      link: 'https://example.com/pr/1',
      task_id: task.id,
    })
    assert(todo.id, 'todo_for_james created')

    const done = await call<TaskBrief>('kanban_update_task', {
      task_id: task.id,
      status: 'done',
      summary: 'All good.',
      pr_url: 'https://example.com/pr/1',
    })
    assert(done.stage === 'done', 'update_task done moves stage to done')
    snap = await db.collection('tasks').doc(task.id).get()
    assert(
      snap.get('stage') === 'done' &&
        snap.get('agentId') === null &&
        typeof snap.get('doneAt') === 'number' &&
        (snap.get('pr') as { url?: string } | null)?.url === 'https://example.com/pr/1',
      'stored task is done, unbound, doneAt stamped, pr recorded'
    )

    // Leave the real board clean: remove the test task, its comments and the todo.
    const batch = db.batch()
    for (const d of (await db.collection('comments').where('taskId', '==', task.id).get()).docs)
      batch.delete(d.ref)
    batch.delete(db.collection('todos').doc(todo.id))
    batch.delete(db.collection('tasks').doc(task.id))
    await batch.commit()
    console.log('cleaned up test data')
  }

  console.log('\nall good')
} finally {
  child.kill()
}
