// @vitest-environment jsdom
// decision-notifications 73: when James denies permission, or Chrome already blocks the board,
// tapping the control registers nothing and the overview says notifications are blocked in
// Chrome's site settings.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, screen, waitFor } from '@testing-library/react'
import Deck from '../packages/web/src/pages/Deck.tsx'
import { enablePush, pushState } from '../packages/web/src/lib/push.ts'
import { actions, installClock, renderAt, setBoard, specTask } from './fixtures/web-threads-b2.tsx'
import {
  BLOCKED_LINE,
  DEVICE_ID_KEY,
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

const nothingRegistered = (container: { register: unknown }) => {
  expect(actions.saveDevice).not.toHaveBeenCalled()
  expect(messaging.getToken).not.toHaveBeenCalled()
  expect(container.register).not.toHaveBeenCalled()
  expect(localStorage.getItem(DEVICE_ID_KEY)).toBeNull()
}

describe('decision-notifications 73 blocked', () => {
  installClock()
  beforeEach(() => localStorage.clear())

  it.each([['denied'], ['default']] as const)(
    'permission answered "%s": nothing is registered and the blocked line shows',
    async (answer) => {
      setBoard({ tasks: [specTask()] })
      const { notification, container } = installPush({ request: answer })
      renderAt('/', <Deck />)
      openOverview()
      await act(() => Promise.resolve(tapSwitch()))
      await waitFor(() => expect(screen.getByText(BLOCKED_LINE)).toBeTruthy())
      expect(notification.requestPermission).toHaveBeenCalledTimes(1)
      expect(notifySwitch().getAttribute('aria-checked')).toBe('false')
      nothingRegistered(container)
      expect(userActions('notifications_blocked')).toHaveLength(1)
    }
  )

  it('Chrome already blocking the board: the control says so and a tap registers nothing', async () => {
    setBoard({ tasks: [specTask()] })
    const { container } = installPush({ permission: 'denied' })
    renderAt('/', <Deck />)
    openOverview()
    expect(pushState()).toBe('blocked')
    await act(() => Promise.resolve(tapSwitch()))
    await waitFor(() => expect(screen.getByText(BLOCKED_LINE)).toBeTruthy())
    expect(notifySwitch().getAttribute('aria-checked')).toBe('false')
    nothingRegistered(container)
  })

  it('enablePush answers blocked and writes nothing when permission is denied', async () => {
    setBoard()
    const { container } = installPush({ request: 'denied' })
    await expect(enablePush()).resolves.toBe('blocked')
    nothingRegistered(container)
  })
})
