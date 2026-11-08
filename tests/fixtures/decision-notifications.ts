// Shared fixture for the decision-notifications web suites (71-76, 84-86): the browser's push
// APIs as fakes (Notification, navigator.serviceWorker, PushManager, firebase/messaging) and
// readers for the overview's bell. The data.ts device writes (saveDevice, removeDevice) are
// recorded by the `actions` of web-threads-b2.tsx; the logger by its logSpy.
//
// Each suite wires the messaging mock itself (vi.mock is hoisted per test file):
//   vi.mock('firebase/messaging', async () => (await import(FIXTURE)).messagingModule())
import { afterEach, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { logSpy, press } from './web-threads-b2.tsx'

export const DEVICE_ID_KEY = 'kanban.deviceId'
export const VAPID = 'test-vapid-key'
export const SWITCH_NAME = 'Notify me of decisions'
export const BLOCKED_LINE = "Notifications are blocked in Chrome's site settings."
export const UNAVAILABLE_LINE = 'Not available in this browser'
export const FAILED_LINE = "Couldn't turn on notifications. Try again."

const MESSAGING = { fake: 'messaging' }
export const messaging = {
  getMessaging: vi.fn((..._args: unknown[]) => MESSAGING),
  getToken: vi.fn((..._args: unknown[]) => Promise.resolve('token-1')),
  deleteToken: vi.fn((..._args: unknown[]) => Promise.resolve(true)),
}
export const messagingModule = () => messaging
export const MESSAGING_INSTANCE = MESSAGING

// navigator.serviceWorker: an event target (for `message`) with register().
export class FakeContainer extends EventTarget {
  registration = { scope: '/', fake: 'registration' }
  register = vi.fn((..._args: unknown[]) => Promise.resolve(this.registration))
  ready = Promise.resolve(this.registration)
}

export interface PushOptions {
  permission?: NotificationPermission
  // What Notification.requestPermission() resolves to (and sets as the permission).
  request?: NotificationPermission
  support?: { notification?: boolean; serviceWorker?: boolean; pushManager?: boolean }
  // The token getToken gives; an Error makes it reject.
  token?: string | Error
  // A device id already stored on this browser (notifications on).
  deviceId?: string
}

const g = globalThis as unknown as Record<string, unknown>
const nav = navigator as unknown as Record<string, unknown>

// Installs the fakes for one test (call after setBoard, which clears the mock calls); the
// returned handles read what the browser was asked to do. Everything is removed after each test.
export function installPush(opts: PushOptions = {}) {
  const support = { notification: true, serviceWorker: true, pushManager: true, ...opts.support }
  vi.stubEnv('VITE_FIREBASE_VAPID_KEY', VAPID)
  const notification = {
    permission: opts.permission ?? 'default',
    requestPermission: vi.fn(() => {
      const result = notification.permission === 'denied' ? 'denied' : (opts.request ?? 'granted')
      notification.permission = result
      return Promise.resolve(result)
    }),
  }
  const container = new FakeContainer()
  if (support.notification)
    Object.defineProperty(g, 'Notification', {
      value: notification,
      configurable: true,
      writable: true,
    })
  else delete g.Notification
  if (support.pushManager)
    Object.defineProperty(g, 'PushManager', { value: class {}, configurable: true, writable: true })
  else delete g.PushManager
  if (support.serviceWorker)
    Object.defineProperty(nav, 'serviceWorker', { value: container, configurable: true })
  else delete nav.serviceWorker

  messaging.getMessaging.mockReset()
  messaging.getMessaging.mockReturnValue(MESSAGING)
  messaging.getToken.mockReset()
  if (opts.token instanceof Error) messaging.getToken.mockRejectedValue(opts.token)
  else messaging.getToken.mockResolvedValue(opts.token ?? 'token-1')
  messaging.deleteToken.mockReset()
  messaging.deleteToken.mockResolvedValue(true)
  localStorage.removeItem(DEVICE_ID_KEY)
  if (opts.deviceId) localStorage.setItem(DEVICE_ID_KEY, opts.deviceId)
  return { notification, container }
}

afterEach(() => {
  delete g.Notification
  delete g.PushManager
  delete nav.serviceWorker
  vi.unstubAllEnvs()
})

// ---- the overview's bell --------------------------------------------------------------

export const openOverview = () => press('ArrowDown')
export const notifySwitch = () => screen.getByRole('switch', { name: SWITCH_NAME })
export const tapSwitch = () => fireEvent.click(notifySwitch())

// User actions logged through the logger spy, optionally only one `action`.
export const userActions = (action?: string) =>
  logSpy.event.mock.calls.filter(
    (c) =>
      c[0] === 'user_action' &&
      (action === undefined || (c[1] as { action?: string }).action === action)
  )
