// Sending decision notices to James's devices (docs/features/decision-notifications.md).
// Red-checkpoint stub: signatures only.
import type { DecisionNotice } from '@kanban/shared'

export type PushOutcome =
  { token: string; ok: true } | { token: string; ok: false; code: string; unregistered: boolean }

export interface PushPort {
  sendDecision(notice: DecisionNotice, tokens: string[]): Promise<PushOutcome[]>
}

export function fcmPush(): PushPort {
  return { sendDecision: () => Promise.resolve([]) }
}
