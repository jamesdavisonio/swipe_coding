#!/usr/bin/env node
// kanban watcher: `node wait.ts --agent <agentId>`, run by a session as a background command.
//
// It waits for James's replies to the session's tasks (and the notifier's reports of a PR's failed
// checks, kind ci_failed, from "board"), claims them (marks them received), prints one JSON line
// per reply on stdout and exits 0, which wakes the session. Anything it cannot
// deliver (board offline, unknown or shut-down session, listener or claim error) is one stdout
// line and exit 1. Bad arguments are one line and exit 2, before the board is touched.
// Diagnostics go to stderr through log(); stdout carries only these lines.

import type { Firestore } from 'firebase-admin/firestore'
import { COLLECTIONS as C, WATCHER_SETTLE_MS, type AgentDoc, type Comment } from '@kanban/shared'
import { errorStatus, logFailure } from './app-log.ts'
import { claimReplies, isWatcherReply } from './board.ts'
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

// James's reply is from him; a ci_failed report is the board's own (the notifier's) words.
const replyLine = (c: Comment) =>
  JSON.stringify({
    task: c.taskId,
    kind: c.kind,
    id: c.id,
    from: c.author === 'james' ? 'james' : 'board',
    text: c.body,
  })

// Fails when the session's agent document is missing, or its lastSeen is 0 (it shut down).
function watchSession(
  db: Firestore,
  agentId: string,
  abort: (line: string, target: string, status: string | number) => void,
  onError: (err: Error) => void
): void {
  db.collection(C.agents)
    .doc(agentId)
    .onSnapshot((snap) => {
      if (!snap.exists) abort(`${PREFIX} unknown session ${agentId}`, 'watcher', 'unknown_session')
      else if ((snap.data() as Omit<AgentDoc, 'id'>).lastSeen === 0)
        abort(`${PREFIX} session ${agentId} has shut down`, 'watcher', 'shut_down')
    }, onError)
}

// Calls `onChange` with the replies waiting for the agent after every change. The existing
// composite index serves the query; the author and kind are checked here (isWatcherReply).
function watchReplies(
  db: Firestore,
  agentId: string,
  pending: Map<string, Comment>,
  onChange: () => void,
  onError: (err: Error) => void
): void {
  db.collection(C.comments)
    .where('agentId', '==', agentId)
    .where('deliveredAt', '==', null)
    .orderBy('createdAt', 'asc')
    .onSnapshot((snap) => {
      for (const change of snap.docChanges()) {
        const c: Comment = { ...(change.doc.data() as Omit<Comment, 'id'>), id: change.doc.id }
        if (change.type === 'removed') pending.delete(c.id)
        else if (isWatcherReply(c)) pending.set(c.id, c)
      }
      onChange()
    }, onError)
}

function watch(agentId: string): void {
  const db = getDb()
  const pending = new Map<string, Comment>()
  // Set from the first pending reply until a claim has settled: one timer or one claim at a time,
  // so only a single claim is ever in flight.
  let settling: NodeJS.Timeout | null = null
  let inflight: Promise<number> | null = null // a claim under way: how many replies it claimed
  let aborting = false // set before any await once a failure starts: no new claim begins

  // A failure stops the watcher, but never loses a reply: a claim already under way is awaited,
  // and if it claimed anything those replies are printed (exit 0) instead of the failure.
  const abort = (line: string, target: string, status: string | number): void => {
    if (aborting) return
    aborting = true
    if (settling) clearTimeout(settling)
    void (async () => {
      try {
        const claimed = await inflight
        if (claimed !== null && claimed > 0) return
      } catch (err) {
        log(`the claim in flight threw (nothing printed): ${(err as Error).message}`)
      }
      await fail(agentId, line, target, status)
    })()
  }
  const onError = (err: Error): void =>
    abort(`${PREFIX} board error: ${err.message}`, 'firestore', errorStatus(err))

  // Once replies are pending, wait for the rest of a burst, then claim them all.
  const arm = () => {
    if (pending.size > 0 && !settling && !aborting)
      settling = setTimeout(() => void claim(), WATCHER_SETTLE_MS)
  }
  const claim = async () => {
    if (aborting) return
    const ids = [...pending.values()].sort((a, b) => a.createdAt - b.createdAt).map((c) => c.id)
    pending.clear()
    if (ids.length === 0) {
      settling = null
      return
    }
    inflight = claimReplies(db, agentId, ids).then((claimed) => {
      log(`claimed ${claimed.length} of ${ids.length} replies`)
      if (claimed.length > 0) finish(claimed.map(replyLine), EXIT_OK)
      return claimed.length
    })
    try {
      if ((await inflight) > 0) return // printed; finish() ends the process
    } catch (err) {
      return onError(err as Error)
    }
    // Every reply went to another watcher: back to waiting, re-arming for any that arrived since.
    settling = null
    arm()
  }

  watchSession(db, agentId, abort, onError)
  watchReplies(db, agentId, pending, arm, onError)
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
