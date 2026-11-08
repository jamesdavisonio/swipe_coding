// Decision notifications on this browser (docs/features/decision-notifications.md): whether it can
// receive them, and turning them on and off. On means a device record (data.ts saveDevice) holds
// this browser's push token under a random id kept in localStorage; the desktop agent sends each
// decision to every record's token, and public/sw.js shows it.
import { deleteToken, getMessaging, getToken } from 'firebase/messaging'
import { removeDevice, saveDevice } from '../data.ts'
import { app } from '../firebase.ts'
import { log } from './log.ts'

export const DEVICE_ID_KEY = 'kanban.deviceId'
// The service worker that receives the pushes; Vite copies public/sw.js to the site root.
const SW_URL = '/sw.js'
const FEATURE = 'notifications'

export type PushState = 'unsupported' | 'blocked' | 'off' | 'on'

const canReceivePush = (): boolean =>
  typeof Notification !== 'undefined' &&
  typeof PushManager !== 'undefined' &&
  typeof navigator !== 'undefined' &&
  navigator.serviceWorker !== undefined

// This browser's device id, or null when it has none (or storage is blocked, which reads as off).
function storedDeviceId(): string | null {
  try {
    return localStorage.getItem(DEVICE_ID_KEY)
  } catch {
    return null
  }
}

export function pushState(): PushState {
  if (!canReceivePush()) return 'unsupported'
  if (Notification.permission === 'denied') return 'blocked'
  return Notification.permission === 'granted' && storedDeviceId() !== null ? 'on' : 'off'
}

// This browser's push token, through the board's own service worker. Getting it also hands the
// worker's registration to Firebase Messaging, which deleteToken needs (without it Firebase would
// register its default worker, which this site does not serve).
async function pushToken(): Promise<string> {
  const registration = await navigator.serviceWorker.register(SW_URL)
  const token = await getToken(getMessaging(app), {
    vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
    serviceWorkerRegistration: registration,
  })
  if (!token) throw new Error('no push token')
  return token
}

const reasonOf = (err: unknown): string => {
  const code = (err as { code?: unknown } | null)?.code
  if (typeof code === 'string') return code
  return err instanceof Error ? err.message : String(err)
}

function warnFailed(what: string, err: unknown): void {
  log.warn('feature_error', `Notifications: ${what} failed`, {
    feature: FEATURE,
    reason: reasonOf(err),
  })
}

const userAction = (action: 'notifications_on' | 'notifications_off' | 'notifications_blocked') =>
  log.event('user_action', { feature: FEATURE, action })

// Asks Chrome for permission, then registers this browser: on, blocked (nothing written) or, when
// the token or the record cannot be had, off with nothing stored.
export async function enablePush(): Promise<PushState> {
  if (!canReceivePush()) return 'unsupported'
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    userAction('notifications_blocked')
    return 'blocked'
  }
  try {
    const deviceId = crypto.randomUUID()
    await saveDevice(deviceId, await pushToken())
    localStorage.setItem(DEVICE_ID_KEY, deviceId)
  } catch (err) {
    warnFailed('turning on', err)
    return 'off'
  }
  userAction('notifications_on')
  return 'on'
}

// Deletes this browser's push token and its record and forgets its id. When that fails the browser
// stays as it was (still on), so James can try again.
export async function disablePush(): Promise<PushState> {
  const deviceId = storedDeviceId()
  try {
    await pushToken()
    await deleteToken(getMessaging(app))
    if (deviceId !== null) await removeDevice(deviceId)
    localStorage.removeItem(DEVICE_ID_KEY)
  } catch (err) {
    warnFailed('turning off', err)
    return pushState()
  }
  userAction('notifications_off')
  return 'off'
}

// While on, stores the current token under the same id: a token Chrome rotated replaces the old
// one in the same record. The deck calls it once when it mounts.
export async function refreshPush(): Promise<void> {
  const deviceId = storedDeviceId()
  if (pushState() !== 'on' || deviceId === null) return
  try {
    await saveDevice(deviceId, await pushToken())
  } catch (err) {
    warnFailed('refreshing the token', err)
  }
}
