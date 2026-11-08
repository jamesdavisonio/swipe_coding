// @vitest-environment jsdom
// decision-notifications 75: tapping the on control removes this browser's device record,
// deletes its push token and shows off.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, screen, waitFor } from '@testing-library/react'
import Deck from '../packages/web/src/pages/Deck.tsx'
import { disablePush, pushState } from '../packages/web/src/lib/push.ts'
import { actions, installClock, renderAt, setBoard, specTask } from './fixtures/web-threads-b2.tsx'
import {
  DEVICE_ID_KEY,
  MESSAGING_INSTANCE,
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

describe('decision-notifications 75 turning it off', () => {
  installClock()
  beforeEach(() => localStorage.clear())

  it('shows on when this browser is registered', () => {
    setBoard({ tasks: [specTask()] })
    installPush({ permission: 'granted', deviceId: 'dev-1' })
    renderAt('/', <Deck />)
    openOverview()
    expect(notifySwitch().getAttribute('aria-checked')).toBe('true')
    expect(pushState()).toBe('on')
  })

  it('a tap deletes the token, removes the record, forgets the id and shows off', async () => {
    setBoard({ tasks: [specTask()] })
    installPush({ permission: 'granted', deviceId: 'dev-1' })
    renderAt('/', <Deck />)
    openOverview()
    await act(() => Promise.resolve(tapSwitch()))
    await waitFor(() => expect(notifySwitch().getAttribute('aria-checked')).toBe('false'))
    expect(messaging.deleteToken).toHaveBeenCalledTimes(1)
    expect(messaging.deleteToken.mock.calls[0][0]).toBe(MESSAGING_INSTANCE)
    expect(actions.removeDevice).toHaveBeenCalledTimes(1)
    expect(actions.removeDevice).toHaveBeenCalledWith('dev-1')
    expect(localStorage.getItem(DEVICE_ID_KEY)).toBeNull()
    expect(pushState()).toBe('off')
    expect(userActions('notifications_off')).toHaveLength(1)
    expect(screen.queryByText(/blocked/)).toBeNull()
  })

  it('disablePush answers off', async () => {
    setBoard()
    installPush({ permission: 'granted', deviceId: 'dev-1' })
    await expect(disablePush()).resolves.toBe('off')
    expect(actions.removeDevice).toHaveBeenCalledWith('dev-1')
  })
})
