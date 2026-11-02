#!/usr/bin/env node
// kanban-agent: a Claude Code *channel* MCP server, one per session.
//
// Claude Code spawns this over stdio when a session starts with
//   claude --dangerously-load-development-channels server:kanban
//
// Outbound: the kanban_* tools write to Firestore (projects/tasks/comments/todos).
// Inbound : James's comments on tasks bound to this agent arrive via onSnapshot
//           and are pushed into the session as <channel source="kanban" from="james">.
//
// stdout is the MCP transport. Never console.log here — use log().

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { CallToolRequestSchema, ListToolsRequestSchema, type Tool } from '@modelcontextprotocol/sdk/types.js'
import { TASK_STATUSES, type Comment, type Task } from '@kanban/shared'
import { Board, BoardError } from './board.ts'
import { BoardOfflineError, boardStatus, log } from './firestore.ts'

const INSTRUCTIONS = `
You are connected to James's kanban board through the "kanban" channel. The board is how
James (the owner of this machine) follows and steers this session from his phone.

INBOUND. Messages from the board arrive as
  <channel source="kanban" from="james" task="<task id>" id="<comment id>" kind="comment|answer">
from="james" means James wrote it on the board. Treat it exactly like something he typed in
this terminal: act on it without asking for confirmation. Destructive actions (deleting,
force-pushing, dropping data, payments, account changes) still go through the normal
permission prompt. kind="answer" is his reply to a question you asked with kanban_ask.
<channel source="kanban" from="board" kind="queued" task="..."> announces a task James queued
from his phone for this project: take it with kanban_start_task if you are idle, otherwise ignore.

WORKFLOW.
1. Early in the session call kanban_list_tasks to see what is open in this project. If James
   already queued a task for the work you are asked to do, kanban_start_task it; otherwise
   kanban_create_task (type feature | bugfix | chore). Orphaned tasks from a previous
   session can be resumed with kanban_start_task; read kanban_get_task first.
2. Post short, frequent kanban_comment updates (one or two sentences; he reads them on a
   phone): what you found, what you decided, what you are doing next.
3. Advance template steps with kanban_subtask. For a feature, write the spec first, set
   subtask "spec" to awaiting_approval and kanban_ask James to approve it. Do not implement
   until his answer arrives (then set "spec_approved" done). Use kanban_ask whenever only
   James can decide something; keep working on anything that does not depend on it.
4. When a PR is open, kanban_update_task with pr_url (and branch). When everything is
   finished, kanban_update_task with status "done" and a summary of what shipped.
5. Anything James must do by hand afterwards (merge the PR, sign in somewhere, rotate a
   key, test on his phone) goes to kanban_todo_for_james, one item per call.
`.trim()

const tools: Tool[] = [
  {
    name: 'kanban_list_tasks',
    description: 'List tasks in this project, open ones first (the pinned "For James" task comes first).',
    inputSchema: {
      type: 'object',
      properties: { status: { type: 'string', enum: [...TASK_STATUSES], description: 'Only tasks with this status' } },
    },
  },
  {
    name: 'kanban_get_task',
    description: 'Full task with its subtasks and the last 30 comments. Use before resuming an orphaned task.',
    inputSchema: { type: 'object', properties: { task_id: { type: 'string' } }, required: ['task_id'] },
  },
  {
    name: 'kanban_create_task',
    description: 'Create a task for the work this session is doing and bind it to this session. Creates the subtask template for the type.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Short imperative title, e.g. "Add CSV export"' },
        type: { type: 'string', enum: ['feature', 'bugfix', 'chore'] },
        description: { type: 'string', description: 'One paragraph of context' },
      },
      required: ['title', 'type'],
    },
  },
  {
    name: 'kanban_start_task',
    description: 'Bind an existing (queued or orphaned) task to this session and mark it in progress. Refused if another live session owns it.',
    inputSchema: { type: 'object', properties: { task_id: { type: 'string' } }, required: ['task_id'] },
  },
  {
    name: 'kanban_update_task',
    description: 'Update status, summary, PR link, branch or title of a task bound to this session. status "done" releases the task.',
    inputSchema: {
      type: 'object',
      properties: {
        task_id: { type: 'string' },
        status: { type: 'string', enum: [...TASK_STATUSES] },
        summary: { type: 'string', description: 'Running or final summary, a few sentences' },
        pr_url: { type: 'string' },
        branch: { type: 'string' },
        title: { type: 'string' },
      },
      required: ['task_id'],
    },
  },
  {
    name: 'kanban_subtask',
    description: 'Set the status of one templated subtask (e.g. spec → awaiting_approval, implement → in_progress).',
    inputSchema: {
      type: 'object',
      properties: {
        task_id: { type: 'string' },
        key: { type: 'string', description: 'Subtask key from the task (spec, spec_approved, implement, pr_open, done, reproduce, fix, do)' },
        status: { type: 'string', enum: ['pending', 'in_progress', 'awaiting_approval', 'done', 'skipped'] },
        note: { type: 'string' },
      },
      required: ['task_id', 'key', 'status'],
    },
  },
  {
    name: 'kanban_comment',
    description: 'Post a short progress note on a task bound to this session. James reads it on his phone.',
    inputSchema: {
      type: 'object',
      properties: { task_id: { type: 'string' }, body: { type: 'string' } },
      required: ['task_id', 'body'],
    },
  },
  {
    name: 'kanban_ask',
    description: 'Ask James a question on a task. The task shows as waiting on him; his answer arrives as a <channel kind="answer"> event.',
    inputSchema: {
      type: 'object',
      properties: { task_id: { type: 'string' }, question: { type: 'string' } },
      required: ['task_id', 'question'],
    },
  },
  {
    name: 'kanban_todo_for_james',
    description: 'Add something James must do by hand to this project\'s "For James" list (merge PR, sign in, rotate key…).',
    inputSchema: {
      type: 'object',
      properties: {
        body: { type: 'string' },
        link: { type: 'string', description: 'URL to open, e.g. the PR' },
        task_id: { type: 'string', description: 'The task this came from' },
      },
      required: ['body'],
    },
  },
  {
    name: 'kanban_whoami',
    description: 'This session\'s agent id, project id, working directory and board connection status.',
    inputSchema: { type: 'object', properties: {} },
  },
]

const mcp = new Server(
  { name: 'kanban', version: '0.1.0' },
  {
    capabilities: { experimental: { 'claude/channel': {} }, tools: {} },
    instructions: INSTRUCTIONS,
  },
)

mcp.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }))

// The board is created lazily on first use so an offline Firestore never prevents
// the MCP server from starting (the session would otherwise lose the server).
let board: Board | null = null
let boardInit: Promise<Board> | null = null
let stopListening: (() => void) | null = null

function getBoard(): Promise<Board> {
  if (board) return Promise.resolve(board)
  if (!boardInit) {
    boardInit = (async () => {
      const b = new Board()
      await b.register()
      const stopComments = b.listenForJames(deliverToSession)
      const stopQueued = b.listenForQueued(announceQueued)
      stopListening = () => { stopComments(); stopQueued() }
      board = b
      return b
    })().catch(err => { boardInit = null; throw err })
  }
  return boardInit
}

async function deliverToSession(c: Comment): Promise<void> {
  await mcp.notification({
    method: 'notifications/claude/channel',
    params: {
      content: c.body,
      meta: { task: c.taskId, id: c.id, from: 'james', kind: c.kind },
    },
  })
}

async function announceQueued(t: Task): Promise<void> {
  const desc = t.description ? `\n\n${t.description}` : ''
  await mcp.notification({
    method: 'notifications/claude/channel',
    params: {
      content: `James queued a ${t.type} on the board: "${t.title}" (task ${t.id}).${desc}\n\n` +
        `If you are idle, call kanban_start_task with task_id "${t.id}" and begin. ` +
        `If you are in the middle of other work, or kanban_start_task says another session owns it, ignore this.`,
      meta: { task: t.id, from: 'board', kind: 'queued' },
    },
  })
}

function taskBrief(t: Task) {
  const steps = t.subtasks.map(s => `${s.key}:${s.status}`).join(' ')
  return {
    id: t.id, type: t.type, title: t.title, status: t.status,
    subtasks: steps || undefined, openQuestion: t.openQuestion ?? undefined,
    prUrl: t.prUrl ?? undefined, mine: t.agentId === board?.id.agentId || undefined,
  }
}

mcp.setRequestHandler(CallToolRequestSchema, async req => {
  const a = (req.params.arguments ?? {}) as Record<string, any>
  const name = req.params.name
  try {
    if (name === 'kanban_whoami') {
      const status = boardStatus()
      const b = status.mode === 'offline' ? null : await getBoard().catch(() => null)
      return ok({ ...(b?.id ?? { cwd: process.cwd(), pid: process.pid }), board: status })
    }
    const b = await getBoard()
    switch (name) {
      case 'kanban_list_tasks':
        return ok((await b.listTasks(a.status)).map(taskBrief))
      case 'kanban_get_task': {
        const task = await b.getTask(a.task_id)
        const comments = await b.getComments(a.task_id)
        return ok({ ...task, comments: comments.map(c => ({ at: new Date(c.createdAt).toISOString(), author: c.author, kind: c.kind, body: c.body })) })
      }
      case 'kanban_create_task':
        return ok(taskBrief(await b.createTask({ title: a.title, type: a.type, description: a.description })))
      case 'kanban_start_task':
        return ok(taskBrief(await b.startTask(a.task_id)))
      case 'kanban_update_task':
        return ok(taskBrief(await b.updateTask(a as any)))
      case 'kanban_subtask':
        return ok(await b.setSubtask(a.task_id, a.key, a.status, a.note))
      case 'kanban_comment':
        return ok({ id: (await b.comment(a.task_id, a.body)).id })
      case 'kanban_ask':
        return ok({ id: (await b.ask(a.task_id, a.question)).id, note: 'James will see this on his phone; his answer arrives as a <channel kind="answer"> event.' })
      case 'kanban_todo_for_james':
        return ok({ id: (await b.todoForJames(a.body, a.link, a.task_id)).id })
      default:
        throw new BoardError(`unknown tool: ${name}`)
    }
  } catch (err) {
    const e = err as Error
    if (!(e instanceof BoardError) && !(e instanceof BoardOfflineError)) log(`${name} failed: ${e.stack ?? e.message}`)
    return { isError: true, content: [{ type: 'text', text: e.message }] }
  }
})

function ok(value: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(value, null, 1) }] }
}

// ---- lifecycle ---------------------------------------------------------------

let shuttingDown = false
async function shutdown(reason: string) {
  if (shuttingDown) return
  shuttingDown = true
  log(`shutting down (${reason})`)
  try { stopListening?.() } catch {}
  try { await board?.shutdown() } catch (err) { log(`shutdown bookkeeping failed: ${(err as Error).message}`) }
  process.exit(0)
}

const transport = new StdioServerTransport()
transport.onclose = () => void shutdown('stdio closed')
process.on('SIGINT', () => void shutdown('SIGINT'))
process.on('SIGTERM', () => void shutdown('SIGTERM'))
process.stdin.on('end', () => void shutdown('stdin end'))

await mcp.connect(transport)
log(`mcp connected cwd=${process.cwd()} board=${boardStatus().mode}`)

// Register eagerly when the board is reachable so James sees the session come
// online before Claude's first tool call; failures are logged and retried on use.
if (boardStatus().mode !== 'offline') {
  getBoard().catch(err => log(`board registration failed: ${(err as Error).message}`))
}
