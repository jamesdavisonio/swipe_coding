// Red-checkpoint stub for docs/features/notifier.md (criteria 107–115): the public shape only.
import type { Firestore } from 'firebase-admin/firestore'
import type { PushPort } from './push.ts'

export interface Notifier {
  stop(): Promise<void>
}

export interface NotifierOptions {
  db?: Firestore
  push?: PushPort
  now?: () => number
  leaseMs?: number
  heartbeatMs?: number
  retryMs?: number
}

export class NotifierBusyError extends Error {
  constructor(message = 'another notifier is running') {
    super(message)
    this.name = 'NotifierBusyError'
  }
}

export function startNotifier(_opts: NotifierOptions = {}): Promise<Notifier> {
  return Promise.resolve({ stop: () => Promise.resolve() })
}
