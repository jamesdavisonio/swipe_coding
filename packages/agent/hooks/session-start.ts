#!/usr/bin/env node
// SessionStart hook: record the Claude session id on the live agent for this
// (hostname, cwd) so the board can show `claude --resume <id>`.
import { COLLECTIONS as C } from '@kanban/shared'
import { findLiveAgent } from '../src/board.ts'
import { boardStatus, getDb, log } from '../src/firestore.ts'
import { host, readHookInput } from './lib.ts'

const input = await readHookInput()
try {
  if (boardStatus().mode === 'offline') throw new Error(boardStatus().detail)
  const db = getDb()
  // The MCP server may still be registering; give it a moment.
  let agent = null
  for (let i = 0; i < 10 && !agent; i++) {
    agent = await findLiveAgent(db, host, input.cwd)
    if (!agent) await new Promise((r) => setTimeout(r, 500))
  }
  if (!agent) {
    log(`hook SessionStart: no live agent for ${host}:${input.cwd} (session ${input.session_id})`)
  } else {
    await db.collection(C.agents).doc(agent.id).update({ claudeSessionId: input.session_id })
    log(`hook SessionStart: agent ${agent.id} ↔ session ${input.session_id}`)
  }
} catch (err) {
  log(`hook SessionStart failed: ${(err as Error).message}`)
}
process.exit(0)
