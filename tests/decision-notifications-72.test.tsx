// @vitest-environment jsdom
// decision-notifications 72: tapping the off control and granting permission registers this
// browser (one device record holding its push token) and the control shows on. A failed
// registration stores nothing and says so.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, screen, waitFor } from '@testing-library/react'
import Deck from '../packages/web/src/pages/Deck.tsx'
import { enablePush, pushState } from '../packages/web/src/lib/push.ts'
import {
  actions,
  installClock,
  logSpy,
  renderAt,
  setBoard,
  specTask,
} from './fixtures/web-threads-b2.tsx'
import {
  DEVICE_ID_KEY,
  FAILED_LINE,
  MESSAGING_INSTANCE,
  VAPID,
  installPush,
  messaging,
  notifySwitch,
  openOverview,
  tapSwitch,
  userActions,
} from './fixtures/decision-notifications.ts'

vi.mock('../packages/web/src/data.ts', async () =>
  (await import('./fixtures/web-threads-b2.tsx')).dataModule()
)
vi.mock('../packages/web/src/lib/log.ts', async () =>
  (await import('./fixtures/web-threads-b2.tsx')).logModule()
)
vi.mock('../packages/web/src/firebase.ts', () => ({ app: {}, auth: {}, db: {} }))
vi.mock('firebase/messaging', async () =>
  (await import('./fixtures/decision-notifications.ts')).messagingModule()
)

describe('decision-notifications 72 turning it on', () => {
  installClock()
  beforeEach(() => localStorage.clear())

  it('asks for permission, registers the worker, stores one device record and shows on', async () => {
    setBoard({ tasks: [specTask()] })
    const { notification, container } = installPush({ token: 'tok-abc' })
    renderAt('/', <Deck />)
    openOverview()
    await act(() => Promise.resolve(tapSwitch()))
    await waitFor(() => expect(notifySwitch().getAttribute('aria-checked')).toBe('true'))
    expect(notification.requestPermission).toHaveBeenCalledTimes(1)
    expect(container.register).toHaveBeenCalledWith('/sw.js')
    expect(messaging.getToken).toHaveBeenCalledWith(
      MESSAGING_INSTANCE,
      expect.objectContaining({
        vapidKey: VAPID,
        serviceWorkerRegistration: container.registration,
      })
    )
    const id = localStorage.getItem(DEVICE_ID_KEY)
    expect(id).toBeTruthy()
    expect(actions.saveDevice).toHaveBeenCalledTimes(1)
    expect(actions.saveDevice).toHaveBeenCalledWith(id, 'tok-abc')
    expect(userActions('notifications_on')).toHaveLength(1)
  })

  it('enablePush answers on, and pushState then reads on', async () => {
    setBoard()
    installPush()
    await expect(enablePush()).resolves.toBe('on')
    expect(pushState()).toBe('on')
  })

  it('a failure stores nothing, leaves the control off and says to try again', async () => {
    setBoard({ tasks: [specTask()] })
    installPush({ token: new Error('push service unreachable') })
    renderAt('/', <Deck />)
    openOverview()
    await act(() => Promise.resolve(tapSwitch()))
    await waitFor(() => expect(screen.getByText(FAILED_LINE)).toBeTruthy())
    expect(notifySwitch().getAttribute('aria-checked')).toBe('false')
    expect(actions.saveDevice).not.toHaveBeenCalled()
    expect(localStorage.getItem(DEVICE_ID_KEY)).toBeNull()
    const warning = logSpy.warn.mock.calls.find((c) => c[0] === 'feature_error')
    expect(warning).toBeTruthy()
    expect(warning?.[2]).toMatchObject({ feature: 'notifications' })
    expect(typeof (warning?.[2] as { reason?: unknown }).reason).toBe('string')
  })

  it('enablePush answers off on a failure', async () => {
    setBoard()
    installPush({ token: new Error('nope') })
    await expect(enablePush()).resolves.toBe('off')
    expect(actions.saveDevice).not.toHaveBeenCalled()
  })
})
