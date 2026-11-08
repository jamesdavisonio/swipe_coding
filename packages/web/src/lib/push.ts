// Decision notifications on this browser (docs/features/decision-notifications.md).
// Red-checkpoint stub: signatures only.
export const DEVICE_ID_KEY = 'kanban.deviceId'

export type PushState = 'unsupported' | 'blocked' | 'off' | 'on'

const notYet = () => new Error('not implemented')

export function pushState(): PushState {
  throw notYet()
}
export function enablePush(): Promise<PushState> {
  return Promise.reject(notYet())
}
export function disablePush(): Promise<PushState> {
  return Promise.reject(notYet())
}
export function refreshPush(): Promise<void> {
  return Promise.reject(notYet())
}
