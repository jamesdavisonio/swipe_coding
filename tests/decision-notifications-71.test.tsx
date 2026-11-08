// @vitest-environment jsdom
// decision-notifications 71: with notifications off on a browser that can receive push, the
// overview shows a control named "Notify me of decisions" in its off state.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import Deck from '../packages/web/src/pages/Deck.tsx'
import { pushState } from '../packages/web/src/lib/push.ts'
import { installClock, renderAt, setBoard, specTask } from './fixtures/web-threads-b2.tsx'
import { installPush, notifySwitch, openOverview } from './fixtures/decision-notifications.ts'

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

describe('decision-notifications 71 the bell is off', () => {
  installClock()
  beforeEach(() => localStorage.clear())

  it('shows the control, off and usable, in the overview', () => {
    setBoard({ tasks: [specTask()] })
    installPush()
    renderAt('/', <Deck />)
    openOverview()
    const control = within(screen.getByRole('dialog')).getByRole('switch', {
      name: 'Notify me of decisions',
    })
    expect(control.getAttribute('aria-checked')).toBe('false')
    expect((control as HTMLButtonElement).disabled).toBe(false)
    expect(pushState()).toBe('off')
  })

  it('is off when permission was granted but this browser has no stored device', () => {
    setBoard({ tasks: [specTask()] })
    installPush({ permission: 'granted' })
    renderAt('/', <Deck />)
    openOverview()
    expect(notifySwitch().getAttribute('aria-checked')).toBe('false')
    expect(pushState()).toBe('off')
  })

  it('shows no blocked or unavailable line while it is simply off', () => {
    setBoard({ tasks: [specTask()] })
    installPush()
    renderAt('/', <Deck />)
    openOverview()
    const text = screen.getByRole('dialog').textContent ?? ''
    expect(text).not.toContain('blocked')
    expect(text).not.toContain('Not available in this browser')
  })
})
