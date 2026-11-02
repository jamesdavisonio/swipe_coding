#!/usr/bin/env node
// SessionEnd hook: belt and braces for the agent's own shutdown. If the MCP
// server was killed without running its handlers, this still marks the agent
// offline and its active tasks orphaned.
import { COLLECTIONS as C } from '@kanban/shared'
import { orphanAgent } from '../src/board.ts'
import { boardStatus, getDb, log } from '../src/firestore.ts'
import { host, readHookInput } from './lib.ts'

const input = await readHookInput()
try {
  if (boardStatus().mode === 'offline') throw new Error(boardStatus().detail)
  const db = getDb()
  // Prefer the agent that recorded this session id; fall back to (hostname, cwd).
  let agentId: string | null = null
  if (input.session_id) {
    const bySession = await db.collection(C.agents).where('claudeSessionId', '==', input.session_id).limit(1).get()
    agentId = bySession.docs[0]?.id ?? null
  }
  if (!agentId) {
    const snap = await db.collection(C.agents).where('hostname', '==', host).where('cwd', '==', input.cwd).get()
    const live = snap.docs.filter(d => d.get('lastSeen') > 0).sort((a, b) => b.get('startedAt') - a.get('startedAt'))
    agentId = live[0]?.id ?? null
  }
  if (!agentId) log(`hook SessionEnd: no agent found for session ${input.session_id} at ${host}:${input.cwd}`)
  else await orphanAgent(db, agentId)
} catch (err) {
  log(`hook SessionEnd failed: ${(err as Error).message}`)
}
process.exit(0)
