// Drives the agent over stdio the way Claude Code does.
//
// Always:   initialize advertises claude/channel + instructions; tools/list is complete.
// Emulator: (FIRESTORE_EMULATOR_HOST set) create a task, write a james comment with the
//           Admin SDK, expect a notifications/claude/channel within 5 s and deliveredAt
//           set; then kanban_ask → task waiting_on_james → answer → in_progress.
import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const entry = join(here, '..', 'src', 'index.ts')
const emulator = process.env.FIRESTORE_EMULATOR_HOST
// KANBAN_TEST_LIVE=1 runs the board checks against the real project using the
// service-account key (same resolution as the agent); test data is cleaned up after.
const live = process.env.KANBAN_TEST_LIVE === '1'
const withBoard = !!emulator || live
const saPath = process.env.KANBAN_SA ?? join(here, '..', '..', '..', '..', 'kanban-secrets', 'sa.json')
const projectId = process.env.KANBAN_PROJECT_ID ?? 'demo-kanban'

const env: NodeJS.ProcessEnv = { ...process.env, KANBAN_PROJECT_ID: projectId }
if (!withBoard) {
  // Force offline mode even if a real service account is configured on this machine.
  delete env.FIRESTORE_EMULATOR_HOST
  env.KANBAN_SA = join(here, 'definitely-missing-sa.json')
}

// Run from the repo root so the project the agent registers is the real one, not packages/agent.
const child = spawn(process.execPath, [entry], { env, cwd: join(here, '..', '..', '..'), stdio: ['pipe', 'pipe', 'pipe'] })
child.stderr.on('data', d => process.stderr.write(`  [agent] ${d}`))

const inbox: any[] = []
let buf = ''
child.stdout.on('data', d => {
  buf += d
  let i
  while ((i = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1)
    if (line) inbox.push(JSON.parse(line))
  }
})

let nextId = 1
function send(method: string, params: any = {}, notify = false) {
  const msg: any = { jsonrpc: '2.0', method, params }
  if (!notify) msg.id = nextId++
  child.stdin.write(JSON.stringify(msg) + '\n')
  return msg.id
}
async function waitFor(pred: (m: any) => boolean, what: string, ms = 5000) {
  const t0 = Date.now()
  while (Date.now() - t0 < ms) {
    const m = inbox.find(pred)
    if (m) return m
    await new Promise(r => setTimeout(r, 25))
  }
  throw new Error(`timeout waiting for ${what}; inbox=${JSON.stringify(inbox).slice(0, 2000)}`)
}
async function call(name: string, args: any = {}) {
  const id = send('tools/call', { name, arguments: args })
  const res = await waitFor(m => m.id === id, `tools/call ${name}`)
  if (res.error) throw new Error(`${name} rpc error: ${JSON.stringify(res.error)}`)
  const text = res.result?.content?.[0]?.text ?? ''
  if (res.result?.isError) throw new Error(`${name} tool error: ${text}`)
  return JSON.parse(text)
}
function assert(cond: any, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`)
  console.log(`ok - ${msg}`)
}

const EXPECTED_TOOLS = [
  'kanban_list_tasks', 'kanban_get_task', 'kanban_create_task', 'kanban_start_task',
  'kanban_update_task', 'kanban_subtask', 'kanban_comment', 'kanban_ask',
  'kanban_todo_for_james', 'kanban_whoami',
]

try {
  const initId = send('initialize', {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: { name: 'protocol-test', version: '0' },
  })
  const init = await waitFor(m => m.id === initId, 'initialize result')
  assert(init.result?.capabilities?.experimental?.['claude/channel'], 'initialize advertises claude/channel')
  assert(init.result?.capabilities?.tools, 'initialize advertises tools')
  assert(/from="james"/.test(init.result?.instructions ?? ''), 'instructions mention from="james"')
  assert(/kanban_ask/.test(init.result?.instructions ?? ''), 'instructions describe the workflow')
  send('notifications/initialized', {}, true)

  const listId = send('tools/list')
  const list = await waitFor(m => m.id === listId, 'tools/list result')
  const names: string[] = list.result.tools.map((t: any) => t.name)
  const missing = EXPECTED_TOOLS.filter(n => !names.includes(n))
  assert(missing.length === 0, `all ${EXPECTED_TOOLS.length} tools listed${missing.length ? ` (missing ${missing.join(', ')})` : ''}`)

  const who = await call('kanban_whoami')
  assert(typeof who.cwd === 'string' && who.board?.mode, `whoami works (board ${who.board.mode})`)

  if (!withBoard) {
    const offId = send('tools/call', { name: 'kanban_list_tasks', arguments: {} })
    const r = await waitFor(m => m.id === offId, 'offline list')
    assert(r.result?.isError && /offline/.test(r.result.content[0].text), 'board tools report offline cleanly')
    console.log('skipped Firestore checks (no emulator)')
  } else {
    const { initializeApp, getApps } = await import('firebase-admin/app')
    const { getFirestore } = await import('firebase-admin/firestore')
    if (getApps().length === 0) {
      if (live) {
        const { cert } = await import('firebase-admin/app')
        const { readFileSync } = await import('node:fs')
        const sa = JSON.parse(readFileSync(saPath, 'utf8'))
        initializeApp({ credential: cert(sa), projectId: sa.project_id })
      } else {
        initializeApp({ projectId })
      }
    }
    const db = getFirestore()

    const task = await call('kanban_create_task', { title: 'Protocol test task', type: 'feature', description: 'created by test' })
    assert(task.id && task.status === 'in_progress' && /spec:pending/.test(task.subtasks), `create_task → ${task.id}`)

    const listed = await call('kanban_list_tasks')
    assert(listed.some((t: any) => t.id === task.id) && listed[0].type === 'for_james', 'list_tasks shows it, For James pinned first')

    const t0 = Date.now()
    const cRef = db.collection('comments').doc()
    await cRef.set({
      taskId: task.id, projectId: who.projectId, agentId: who.agentId, author: 'james', kind: 'comment',
      body: 'Looks good, carry on.', createdAt: t0, deliveredAt: null,
    })
    const ev = await waitFor(m => m.method === 'notifications/claude/channel' && m.params?.meta?.id === cRef.id, 'channel notification')
    assert(ev.params.content === 'Looks good, carry on.', `channel event delivered in ${Date.now() - t0} ms`)
    assert(ev.params.meta.from === 'james' && ev.params.meta.task === task.id && ev.params.meta.kind === 'comment', `meta ${JSON.stringify(ev.params.meta)}`)
    for (let i = 0; i < 40 && (await cRef.get()).get('deliveredAt') == null; i++) await new Promise(r => setTimeout(r, 100))
    assert((await cRef.get()).get('deliveredAt') != null, 'deliveredAt set after delivery')

    await call('kanban_subtask', { task_id: task.id, key: 'spec', status: 'awaiting_approval' })
    await call('kanban_ask', { task_id: task.id, question: 'Approve the spec?' })
    let snap = await db.collection('tasks').doc(task.id).get()
    assert(snap.get('status') === 'waiting_on_james' && snap.get('openQuestion') === 'Approve the spec?', 'ask → waiting_on_james + openQuestion')

    const aRef = db.collection('comments').doc()
    await aRef.set({
      taskId: task.id, projectId: who.projectId, agentId: who.agentId, author: 'james', kind: 'answer',
      body: 'Approved.', createdAt: Date.now(), deliveredAt: null,
    })
    await waitFor(m => m.method === 'notifications/claude/channel' && m.params?.meta?.id === aRef.id, 'answer notification')
    for (let i = 0; i < 40; i++) {
      snap = await db.collection('tasks').doc(task.id).get()
      if (snap.get('status') === 'in_progress') break
      await new Promise(r => setTimeout(r, 100))
    }
    assert(snap.get('status') === 'in_progress' && snap.get('openQuestion') === null, 'answer → in_progress, question cleared')

    const todo = await call('kanban_todo_for_james', { body: 'Merge the PR', link: 'https://example.com/pr/1', task_id: task.id })
    assert(todo.id, 'todo_for_james created')

    const done = await call('kanban_update_task', { task_id: task.id, status: 'done', summary: 'All good.', pr_url: 'https://example.com/pr/1' })
    assert(done.status === 'done' && /pr_open:done/.test(done.subtasks) && /done:done/.test(done.subtasks), 'update_task done closes template steps')
    snap = await db.collection('tasks').doc(task.id).get()
    assert(snap.get('agentId') === null, 'done task is unbound')

    // Leave the real board clean: remove the test task, its comments and the todo.
    const batch = db.batch()
    for (const d of (await db.collection('comments').where('taskId', '==', task.id).get()).docs) batch.delete(d.ref)
    batch.delete(db.collection('todos').doc(todo.id))
    batch.delete(db.collection('tasks').doc(task.id))
    await batch.commit()
    console.log('cleaned up test data')
  }

  console.log('\nall good')
} finally {
  child.kill()
}
