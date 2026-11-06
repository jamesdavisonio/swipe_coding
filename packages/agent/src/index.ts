#!/usr/bin/env node
// kanban-agent: a Claude Code *channel* MCP server, one per session.
//
// Claude Code spawns this over stdio when a session starts with
//   claude --dangerously-load-development-channels server:kanban
//
// Outbound: the kanban_* tools write to Firestore (projects/tasks/comments/todos).
// Inbound : James's replies reach the session through its watcher (wait.ts, started as a
//           background command); only queued-task announcements are pushed as channel events.
//
// stdout is the MCP transport. Never console.log here — use log().

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { join } from 'node:path'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from '@modelcontextprotocol/sdk/types.js'
import {
  LOGS_READ_DEFAULT_LIMIT,
  LOGS_READ_DEFAULT_MINUTES,
  LOGS_READ_MAX_LIMIT,
  LOGS_READ_MAX_MINUTES,
  LOG_SEVERITIES,
  STAGES,
  type Stage,
  type Task,
  type TaskType,
} from '@kanban/shared'
import {
  Board,
  BoardError,
  SUBTASK_STATUSES,
  UPDATE_STATUSES,
  type SubtaskStatus,
  type UpdateStatus,
} from './board.ts'
import { InvalidLogArgError, errorStatus, logFailure, readLogs } from './app-log.ts'
import { BoardOfflineError, boardStatus, log, pkgDir } from './firestore.ts'
import { SESSION_INSTRUCTIONS } from './instructions.ts'

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
      'Advance one stage of the task (e.g. spec → awaiting_approval asks James to approve the spec; done moves the task to its next stage, never to done: finish with kanban_update_task status "done" and a summary).',
    inputSchema: {
      type: 'object',
      properties: {
        task_id: { type: 'string' },
        key: {
          type: 'string',
          description:
            'Stage of the task: spec, approved, build, pr, merged, main_ci, after_deploy (feature); fix (bugfix); do (chore)',
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
      'Ask James a question on a task. The task shows as needing him; his answer is printed by your watcher (the background command from kanban_create_task / kanban_start_task).',
    inputSchema: {
      type: 'object',
      properties: { task_id: { type: 'string' }, question: { type: 'string' } },
      required: ['task_id', 'question'],
    },
  },
  {
    name: 'kanban_answered_in_session',
    description:
      "Record that James answered a board question in this session's own chat: the question closes on the board and the thread shows his answer.",
    inputSchema: {
      type: 'object',
      properties: {
        task_id: { type: 'string' },
        answer: { type: 'string', description: 'His answer, 1 to 2000 characters' },
      },
      required: ['task_id', 'answer'],
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
    name: 'kanban_logs',
    description:
      'Read the board stored app logs (the phone app and this agent): warnings and worse from the last 24 hours, newest first, by default. Pass request_id for the full oldest-first trail of one operation (any severity, either source). Read this before asking James to reproduce a board problem.',
    inputSchema: {
      type: 'object',
      properties: {
        request_id: { type: 'string', description: 'Every event of one operation, oldest first' },
        min_severity: { type: 'string', enum: [...LOG_SEVERITIES], description: 'Default WARNING' },
        since_minutes: {
          type: 'integer',
          minimum: 1,
          maximum: LOGS_READ_MAX_MINUTES,
          description: `Time window, default ${LOGS_READ_DEFAULT_MINUTES}`,
        },
        source: { type: 'string', enum: ['web_client', 'server'] },
        limit: {
          type: 'integer',
          minimum: 1,
          maximum: LOGS_READ_MAX_LIMIT,
          description: `Default ${LOGS_READ_DEFAULT_LIMIT}`,
        },
      },
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
    instructions: SESSION_INSTRUCTIONS,
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
      stopListening = b.listenForQueued(announceQueued)
      board = b
      return b
    })().catch((err: Error) => {
      boardInit = null
      if (!(err instanceof BoardOfflineError))
        void logFailure({
          severity: 'ERROR',
          event_type: 'api_call_failed',
          message: err.message,
          context: { target: 'firestore', status: errorStatus(err) },
        })
      throw err
    })
  }
  return boardInit
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

// The command that starts this session's watcher: absolute path, forward slashes, so it runs
// from any folder in any shell.
function watcherCommand(agentId: string): string {
  const script = join(pkgDir, 'src', 'wait.ts').replaceAll('\\', '/')
  return `node "${script}" --agent ${agentId}`
}

// A task as the session sees it. The two tools that bind a task add the session's watcher.
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
  kanban_answered_in_session: { task_id: string; answer: string }
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
    if (name === 'kanban_logs') return ok(await readLogs(args ?? {}))
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
        const task = await b.createTask({
          title: a.title,
          type: a.type,
          description: a.description,
        })
        return ok({ ...taskBrief(task), watcher: watcherCommand(b.id.agentId) })
      }
      case 'kanban_start_task': {
        const a = argsOf(args, name)
        const task = await b.startTask(a.task_id)
        return ok({ ...taskBrief(task), watcher: watcherCommand(b.id.agentId) })
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
          note: 'James will see this on his phone; his answer is printed by your watcher.',
        })
      }
      case 'kanban_answered_in_session': {
        const a = argsOf(args, name)
        return ok({ id: (await b.answeredInSession(a.task_id, a.answer)).id })
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
    if (
      !(e instanceof BoardError) &&
      !(e instanceof BoardOfflineError) &&
      !(e instanceof InvalidLogArgError)
    ) {
      log(`${name} failed: ${e.stack ?? e.message}`)
      void logFailure({
        severity: 'ERROR',
        event_type: 'feature_error',
        message: e.message,
        context: { feature: name },
      })
    }
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
