// Shared bits for the Claude Code hook scripts. Hooks receive a JSON object on stdin:
//   { session_id, cwd, hook_event_name, ... }
import { hostname } from 'node:os'

export interface HookInput {
  session_id: string
  cwd: string
  hook_event_name: string
  [k: string]: unknown
}

export async function readHookInput(): Promise<HookInput> {
  let raw = ''
  for await (const chunk of process.stdin) raw += chunk
  const input = JSON.parse(raw || '{}') as Partial<HookInput>
  return {
    session_id: String(input.session_id ?? ''),
    cwd: String(input.cwd ?? process.cwd()),
    hook_event_name: String(input.hook_event_name ?? ''),
    ...input,
  }
}

export const host = hostname()
