// @vitest-environment jsdom
// decision-notifications 74: a browser that cannot receive push (no Notification, service worker
// or PushManager) shows the control disabled with "Not available in this browser".
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import Deck from '../packages/web/src/pages/Deck.tsx'
import { pushState } from '../packages/web/src/lib/push.ts'
import { installClock, renderAt, setBoard, specTask } from './fixtures/web-threads-b2.tsx'
import {
  UNAVAILABLE_LINE,
  installPush,
  notifySwitch,
  openOverview,
  type PushOptions,
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

describe('decision-notifications 74 unsupported', () => {
  installClock()
  beforeEach(() => localStorage.clear())

  it.each([
    ['notifications', { notification: false }],
    ['a service worker', { serviceWorker: false }],
    ['push', { pushManager: false }],
  ] as [string, NonNullable<PushOptions['support']>][])(
    'without %s the control is disabled and the line shows',
    (_name, support) => {
      setBoard({ tasks: [specTask()] })
      const { notification } = installPush({ support })
      renderAt('/', <Deck />)
      openOverview()
      expect((notifySwitch() as HTMLButtonElement).disabled).toBe(true)
      expect(notifySwitch().getAttribute('aria-checked')).toBe('false')
      expect(screen.getByText(UNAVAILABLE_LINE)).toBeTruthy()
      expect(pushState()).toBe('unsupported')
      fireEvent.click(notifySwitch())
      expect(notification.requestPermission).not.toHaveBeenCalled()
    }
  )

  it('a browser that can receive push does not show the line', () => {
    setBoard({ tasks: [specTask()] })
    installPush()
    renderAt('/', <Deck />)
    openOverview()
    expect(screen.queryByText(UNAVAILABLE_LINE)).toBeNull()
  })
})
