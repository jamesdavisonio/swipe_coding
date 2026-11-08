// @vitest-environment jsdom
// decision-notifications 76: with the control on and the board loading again, the browser keeps
// one device record: a changed push token replaces the stored one (same record id). The deck
// page refreshes it once on mount. (The stored record itself: tests/emulator/decision-notifications-76.)
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { waitFor } from '@testing-library/react'
import Deck from '../packages/web/src/pages/Deck.tsx'
import { refreshPush } from '../packages/web/src/lib/push.ts'
import { actions, installClock, renderAt, setBoard, specTask } from './fixtures/web-threads-b2.tsx'
import { DEVICE_ID_KEY, installPush, messaging } from './fixtures/decision-notifications.ts'

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

describe('decision-notifications 76 one record per browser', () => {
  installClock()
  beforeEach(() => localStorage.clear())

  it('the deck mounting with notifications on saves the current token under the same id, once', async () => {
    setBoard({ tasks: [specTask()] })
    installPush({ permission: 'granted', deviceId: 'dev-1', token: 'rotated-token' })
    renderAt('/', <Deck />)
    await waitFor(() => expect(actions.saveDevice).toHaveBeenCalledTimes(1))
    expect(actions.saveDevice).toHaveBeenCalledWith('dev-1', 'rotated-token')
    expect(localStorage.getItem(DEVICE_ID_KEY)).toBe('dev-1')
  })

  it('refreshPush with notifications on writes the same id and never another', async () => {
    setBoard()
    installPush({ permission: 'granted', deviceId: 'dev-1', token: 'new-token' })
    await refreshPush()
    await refreshPush()
    expect(actions.saveDevice.mock.calls).toEqual([
      ['dev-1', 'new-token'],
      ['dev-1', 'new-token'],
    ])
    expect(localStorage.getItem(DEVICE_ID_KEY)).toBe('dev-1')
  })

  it('with notifications off the deck mounting asks for no token and writes nothing', async () => {
    setBoard({ tasks: [specTask()] })
    installPush({ permission: 'granted' })
    renderAt('/', <Deck />)
    await refreshPush()
    expect(messaging.getToken).not.toHaveBeenCalled()
    expect(actions.saveDevice).not.toHaveBeenCalled()
    expect(localStorage.getItem(DEVICE_ID_KEY)).toBeNull()
  })
})
