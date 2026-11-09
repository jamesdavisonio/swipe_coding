// @vitest-environment jsdom
// launch-session 116: the deck's dock shows a "New session" button at its bottom right; tapping it,
// or Enter / Space on it, opens the New session sheet. (The 44 px target and the focus ring are CSS
// and are not observable in jsdom; what is observable is a real, enabled, focusable button.)
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { installClock, isBefore, specTask } from './fixtures/web-threads-b2.tsx'
import { newSessionButton, renderDeck, sheetOpen } from './fixtures/launch-session-web.tsx'

vi.mock('../packages/web/src/data.ts', async () =>
  (await import('./fixtures/web-threads-b6.tsx')).dataModule()
)
vi.mock('../packages/web/src/lib/log.ts', async () =>
  (await import('./fixtures/web-threads-b2.tsx')).logModule()
)
vi.mock('../packages/web/src/firebase.ts', () => ({ app: {}, auth: {}, db: {} }))

describe('launch-session 116: the New session button', () => {
  installClock()

  it('is a button named "New session" in the dock, with no sheet open yet', () => {
    renderDeck([specTask()])
    const button = newSessionButton()
    expect(button.tagName).toBe('BUTTON')
    expect((button as HTMLButtonElement).disabled).toBe(false)
    expect(button.tabIndex).toBeGreaterThanOrEqual(0)
    expect(sheetOpen()).toBe(false)
  })

  it('sits at the right of the dock: after the Change it button and the to-do button', () => {
    renderDeck([specTask()])
    expect(isBefore(screen.getByRole('button', { name: /^To-dos, / }), newSessionButton())).toBe(
      true
    )
    expect(isBefore(screen.getByRole('button', { name: 'Change it' }), newSessionButton())).toBe(
      true
    )
  })

  it('stays on an empty deck', () => {
    renderDeck([])
    expect(newSessionButton()).toBeTruthy()
  })

  it('tapping it opens the New session sheet', () => {
    renderDeck([specTask()])
    fireEvent.click(newSessionButton())
    expect(sheetOpen()).toBe(true)
    expect(screen.getByRole('dialog', { name: 'New session' }).getAttribute('aria-modal')).toBe(
      'true'
    )
  })

  it.each([['Enter'], [' ']])('pressing %j on it opens the sheet', async (key) => {
    renderDeck([specTask()])
    const user = userEvent.setup()
    newSessionButton().focus()
    expect(document.activeElement).toBe(newSessionButton())
    await user.keyboard(key === ' ' ? '[Space]' : '[Enter]')
    expect(sheetOpen()).toBe(true)
  })
})
