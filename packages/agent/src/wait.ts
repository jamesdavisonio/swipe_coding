#!/usr/bin/env node
// kanban watcher: `node wait.ts --agent <agentId>`, run by a session as a background command.
//
// It waits for James's replies to the session's tasks, claims them (marks them received), prints
// one JSON line per reply on stdout and exits 0, which wakes the session. Anything it cannot
// deliver (board offline, unknown or shut-down session, listener or claim error) is one stdout
// line and exit 1. Bad arguments are one line and exit 2, before the board is touched.
// Diagnostics go to stderr through log(); stdout carries only these lines.

import { COLLECTIONS as C, WATCHER_SETTLE_MS, type AgentDoc, type Comment } from '@kanban/shared'
import { errorStatus, logFailure } from './app-log.ts'
import { claimReplies } from './board.ts'
import { boardStatus, getDb, log } from './firestore.ts'

const AGENT_ID = /^[A-Za-z0-9_-]{1,64}$/
const PREFIX = 'kanban watcher:'

const EXIT_OK = 0
const EXIT_FAILED = 1
const EXIT_USAGE = 2

// Writes the lines to stdout, then ends the process once they are flushed. Only the first call
// counts: a second event while the first is flushing must not add lines.
let finishing = false
function finish(lines: string[], code: number): void {
  if (finishing) return
  finishing = true
  const text = lines.map((l) => `${l}\n`).join('')
  process.stdout.write(text, () => process.exit(code))
}

// One line saying why, a stored WARNING, exit 1.
async function fail(
  agentId: string,
  line: string,
  target: string,
  status: string | number
): Promise<void> {
  await logFailure({
    severity: 'WARNING',
    event_type: 'api_call_failed',
    message: line,
    context: { target, status, watched_agent: agentId },
  })
  finish([line], EXIT_FAILED)
}

function parseAgentId(argv: string[]): string | null {
  const [flag, id, ...rest] = argv
  return flag === '--agent' && id !== undefined && rest.length === 0 && AGENT_ID.test(id)
    ? id
    : null
}

const replyLine = (c: Comment) =>
  JSON.stringify({ task: c.taskId, kind: c.kind, id: c.id, from: 'james', text: c.body })

function watch(agentId: string): void {
  const db = getDb()
  const boardError = (err: Error): void =>
    void fail(agentId, `${PREFIX} board error: ${err.message}`, 'firestore', errorStatus(err))
  const shutDown = (): void =>
    void fail(agentId, `${PREFIX} session ${agentId} has shut down`, 'watcher', 'shut_down')

  const pending = new Map<string, Comment>()
  let settling: NodeJS.Timeout | null = null

  const claim = async () => {
    const ids = [...pending.values()].sort((a, b) => a.createdAt - b.createdAt).map((c) => c.id)
    pending.clear()
    try {
      const claimed = ids.length > 0 ? await claimReplies(db, ids) : []
      log(`claimed ${claimed.length} of ${ids.length} replies`)
      if (claimed.length > 0) return finish(claimed.map(replyLine), EXIT_OK)
    } catch (err) {
      return boardError(err as Error)
    }
    // Every reply went to another watcher: back to waiting.
    settling = null
    if (pending.size > 0) settling = setTimeout(() => void claim(), WATCHER_SETTLE_MS)
  }

  db.collection(C.agents)
    .doc(agentId)
    .onSnapshot((snap) => {
      if (!snap.exists)
        return void fail(
          agentId,
          `${PREFIX} unknown session ${agentId}`,
          'watcher',
          'unknown_session'
        )
      if ((snap.data() as Omit<AgentDoc, 'id'>).lastSeen === 0) shutDown()
    }, boardError)

  // The existing composite index serves this query; the author is checked here.
  db.collection(C.comments)
    .where('agentId', '==', agentId)
    .where('deliveredAt', '==', null)
    .orderBy('createdAt', 'asc')
    .onSnapshot((snap) => {
      for (const change of snap.docChanges()) {
        const c: Comment = { ...(change.doc.data() as Omit<Comment, 'id'>), id: change.doc.id }
        if (change.type === 'removed') pending.delete(c.id)
        else if (c.author === 'james') pending.set(c.id, c)
      }
      if (pending.size > 0 && !settling)
        settling = setTimeout(() => void claim(), WATCHER_SETTLE_MS)
    }, boardError)
}

const agentId = parseAgentId(process.argv.slice(2))
if (agentId === null)
  finish(
    [`${PREFIX} invalid arguments: expected exactly --agent <id> (1-64 of A-Z a-z 0-9 _ -)`],
    EXIT_USAGE
  )
else if (boardStatus().mode === 'offline')
  await fail(agentId, `${PREFIX} board offline: ${boardStatus().detail}`, 'firestore', 'offline')
else watch(agentId)
