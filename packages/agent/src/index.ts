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
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from '@modelcontextprotocol/sdk/types.js'
import { STAGES, type Comment, type Stage, type Task, type TaskType } from '@kanban/shared'
import {
  Board,
  BoardError,
  SUBTASK_STATUSES,
  UPDATE_STATUSES,
  type SubtaskStatus,
  type UpdateStatus,
} from './board.ts'
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
3. Advance the task's stages with kanban_subtask; the key is a stage: spec, approved, build,
   pr, merged, main_ci, after_deploy, done (feature), fix instead of spec/approved/build (bugfix),
   do (chore). Marking a stage done moves the task to the next one. For a feature, write the
   spec first and set "spec" to awaiting_approval; that is how James is asked to approve it,
   so do not also kanban_ask. His approval arrives as a channel event: do not implement until
   it does (then mark "spec" and "approved" done). Use kanban_ask for real questions only, when
   something else needs his decision; keep working on anything that does not depend on it.
4. When a PR is open, kanban_update_task with pr_url. When everything is finished,
   kanban_update_task with status "done" and a summary of what shipped.
5. Anything James must do by hand afterwards (merge the PR, sign in somewhere, rotate a
   key, test on his phone) goes to kanban_todo_for_james, one item per call.
`.trim()

const tools: Tool[] = [
  {
    name: 'kanban_list_tasks',
    description:
      'List tasks in this project, open ones first (the pinned "For James" task comes first).',
    inputSchema: {
      type: 'object',
      properties: {
        stage: {
          type: 'string',
          enum: [...STAGES],
          description: 'Only tasks at this stage',
        },
      },
    },
  },
  {
    name: 'kanban_get_task',
    description:
      'Full task (stage, what it needs from James, decision log) and the last 30 comments. Use before resuming a task from a previous session.',
    inputSchema: {
      type: 'object',
      properties: { task_id: { type: 'string' } },
      required: ['task_id'],
    },
  },
  {
    name: 'kanban_create_task',
    description:
      'Create a task for the work this session is doing and bind it to this session. It starts at the first stage of its type.',
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
    description:
      'Bind an existing (queued or left-behind) task to this session. Refused if another live session owns it.',
    inputSchema: {
      type: 'object',
      properties: { task_id: { type: 'string' } },
      required: ['task_id'],
    },
  },
  {
    name: 'kanban_update_task',
    description:
      'Update summary, PR link, title or status of a task bound to this session. status "done" finishes and releases the task; status "in_progress" clears whatever it was waiting on from James.',
    inputSchema: {
      type: 'object',
      properties: {
        task_id: { type: 'string' },
        status: { type: 'string', enum: [...UPDATE_STATUSES] },
        summary: { type: 'string', description: 'Running or final summary, a few sentences' },
        pr_url: { type: 'string', description: 'Pull request URL ending in its number' },
        title: { type: 'string' },
      },
      required: ['task_id'],
    },
  },
  {
    name: 'kanban_subtask',
    description:
      'Advance one stage of the task (e.g. spec → awaiting_approval asks James to approve the spec; done moves the task to its next stage).',
    inputSchema: {
      type: 'object',
      properties: {
        task_id: { type: 'string' },
        key: {
          type: 'string',
          description:
            'Stage of the task: spec, approved, build, pr, merged, main_ci, after_deploy, done (feature); fix (bugfix); do (chore)',
        },
        status: {
          type: 'string',
          enum: [...SUBTASK_STATUSES],
        },
        note: { type: 'string', description: 'Posted to the thread as a short update' },
      },
      required: ['task_id', 'key', 'status'],
    },
  },
  {
    name: 'kanban_comment',
    description:
      'Post a short progress note on a task bound to this session. James reads it on his phone.',
    inputSchema: {
      type: 'object',
      properties: { task_id: { type: 'string' }, body: { type: 'string' } },
      required: ['task_id', 'body'],
    },
  },
  {
    name: 'kanban_ask',
    description:
      'Ask James a question on a task. The task shows as needing him; his answer arrives as a <channel kind="answer"> event.',
    inputSchema: {
      type: 'object',
      properties: { task_id: { type: 'string' }, question: { type: 'string' } },
      required: ['task_id', 'question'],
    },
  },
  {
    name: 'kanban_todo_for_james',
    description:
      'Add something James must do by hand to this project\'s "For James" list (merge PR, sign in, rotate key…).',
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
    description:
      "This session's agent id, project id, working directory and board connection status.",
    inputSchema: { type: 'object', properties: {} },
  },
]

const mcp = new Server(
  { name: 'kanban', version: '0.1.0' },
  {
    capabilities: { experimental: { 'claude/channel': {} }, tools: {} },
    instructions: INSTRUCTIONS,
  }
)

mcp.setRequestHandler(ListToolsRequestSchema, () => ({ tools }))

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
      stopListening = () => {
        stopComments()
        stopQueued()
      }
      board = b
      return b
    })().catch((err) => {
      boardInit = null
      throw err
    })
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
      content:
        `James queued a ${t.type} on the board: "${t.title}" (task ${t.id}).${desc}\n\n` +
        `If you are idle, call kanban_start_task with task_id "${t.id}" and begin. ` +
        `If you are in the middle of other work, or kanban_start_task says another session owns it, ignore this.`,
      meta: { task: t.id, from: 'board', kind: 'queued' },
    },
  })
}

function taskBrief(t: Task) {
  return {
    id: t.id,
    type: t.type,
    title: t.title,
    stage: t.stage,
    needs: t.needs,
    pr: t.pr ?? undefined,
    mine: t.agentId === board?.id.agentId || undefined,
  }
}

// Each tool's arguments as its inputSchema above declares them. Claude Code validates calls
// against those schemas before they reach us, so required fields are typed as present; the
// Board re-checks anything that matters (ids, statuses, ownership).
interface ToolArgs {
  kanban_list_tasks: { stage?: Stage }
  kanban_get_task: { task_id: string }
  kanban_create_task: { title: string; type: TaskType; description?: string }
  kanban_start_task: { task_id: string }
  kanban_update_task: {
    task_id: string
    status?: UpdateStatus
    summary?: string
    pr_url?: string
    title?: string
  }
  kanban_subtask: { task_id: string; key: string; status: SubtaskStatus; note?: string }
  kanban_comment: { task_id: string; body: string }
  kanban_ask: { task_id: string; question: string }
  kanban_todo_for_james: { body: string; link?: string; task_id?: string }
}
function argsOf<N extends keyof ToolArgs>(
  args: Record<string, unknown> | undefined,
  _tool: N
): ToolArgs[N] {
  return (args ?? {}) as ToolArgs[N]
}

mcp.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params
  try {
    if (name === 'kanban_whoami') {
      const status = boardStatus()
      const b = status.mode === 'offline' ? null : await getBoard().catch(() => null)
      return ok({ ...(b?.id ?? { cwd: process.cwd(), pid: process.pid }), board: status })
    }
    const b = await getBoard()
    switch (name) {
      case 'kanban_list_tasks': {
        const a = argsOf(args, name)
        return ok((await b.listTasks(a.stage)).map(taskBrief))
      }
      case 'kanban_get_task': {
        const a = argsOf(args, name)
        const task = await b.getTask(a.task_id)
        const comments = await b.getComments(a.task_id)
        return ok({
          ...task,
          comments: comments.map((c) => ({
            at: new Date(c.createdAt).toISOString(),
            author: c.author,
            kind: c.kind,
            body: c.body,
          })),
        })
      }
      case 'kanban_create_task': {
        const a = argsOf(args, name)
        return ok(
          taskBrief(
            await b.createTask({ title: a.title, type: a.type, description: a.description })
          )
        )
      }
      case 'kanban_start_task': {
        const a = argsOf(args, name)
        return ok(taskBrief(await b.startTask(a.task_id)))
      }
      case 'kanban_update_task':
        return ok(taskBrief(await b.updateTask(argsOf(args, name))))
      case 'kanban_subtask': {
        const a = argsOf(args, name)
        return ok(taskBrief(await b.setSubtask(a.task_id, a.key, a.status, a.note)))
      }
      case 'kanban_comment': {
        const a = argsOf(args, name)
        return ok({ id: (await b.comment(a.task_id, a.body)).id })
      }
      case 'kanban_ask': {
        const a = argsOf(args, name)
        return ok({
          id: (await b.ask(a.task_id, a.question)).id,
          note: 'James will see this on his phone; his answer arrives as a <channel kind="answer"> event.',
        })
      }
      case 'kanban_todo_for_james': {
        const a = argsOf(args, name)
        return ok({ id: (await b.todoForJames(a.body, a.link, a.task_id)).id })
      }
      default:
        throw new BoardError(`unknown tool: ${name}`)
    }
  } catch (err) {
    const e = err as Error
    if (!(e instanceof BoardError) && !(e instanceof BoardOfflineError))
      log(`${name} failed: ${e.stack ?? e.message}`)
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
  try {
    stopListening?.()
  } catch (err) {
    log(`stopping listeners failed: ${(err as Error).message}`)
  }
  try {
    await board?.shutdown()
  } catch (err) {
    log(`shutdown bookkeeping failed: ${(err as Error).message}`)
  }
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
  getBoard().catch((err) => log(`board registration failed: ${(err as Error).message}`))
}
