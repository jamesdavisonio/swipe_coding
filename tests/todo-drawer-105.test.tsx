// @vitest-environment jsdom
// todo-drawer 105: while the to-do dialog is open nothing of the sheet shows above it: it is the
// top layer (after the sheet, not inside it) and the tapped row's focus ring is gone because focus
// has moved into the dialog. The tap-highlight colour and stacking values are CSS, which jsdom
// cannot see; the spec names no class for them, so they are not asserted here.
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import Deck from '../packages/web/src/pages/Deck.tsx'
import { installClock, isBefore, makeTodo, renderAt } from './fixtures/web-threads-b2.tsx'
import { setB5Board } from './fixtures/web-threads-b5.tsx'

vi.mock('../packages/web/src/data.ts', async () =>
  (await import('./fixtures/web-threads-b6.tsx')).dataModule()
)
vi.mock('../packages/web/src/lib/log.ts', async () =>
  (await import('./fixtures/web-threads-b2.tsx')).logModule()
)
vi.mock('../packages/web/src/firebase.ts', () => ({ app: {}, auth: {}, db: {} }))

describe('todo-drawer 105: nothing of the sheet above the dialog', () => {
  installClock()

  function openItem() {
    setB5Board({ todos: [makeTodo('a', { body: 'Water the plants' }), makeTodo('b')] })
    renderAt('/', <Deck />)
    fireEvent.click(screen.getByRole('button', { name: 'To-dos, 2 open' }))
    const row = screen.getByRole('button', { name: 'Water the plants' })
    row.focus()
    fireEvent.click(row)
    const toggle = screen.getByRole('button', { name: 'Mark done' })
    return {
      row,
      dialog: toggle.closest<HTMLElement>('[role="dialog"], [role="alertdialog"]')!,
      sheet: screen.getByRole('dialog', { name: 'To-dos', hidden: true }),
    }
  }

  it('renders the dialog outside the sheet and after it, as the last layer', () => {
    const { dialog, sheet } = openItem()
    expect(sheet.contains(dialog)).toBe(false)
    expect(dialog.contains(sheet)).toBe(false)
    expect(isBefore(sheet, dialog)).toBe(true)
  })

  it('moves focus off the tapped row into the dialog', () => {
    const { row, dialog } = openItem()
    expect(document.activeElement).not.toBe(row)
    expect(dialog.contains(document.activeElement)).toBe(true)
  })

  it('keeps focus in the dialog if the row text is focused behind it', () => {
    const { row, dialog } = openItem()
    row.focus()
    expect(dialog.contains(document.activeElement)).toBe(true)
  })
})
