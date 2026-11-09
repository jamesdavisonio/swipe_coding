// @vitest-environment jsdom
// launch-session 117: the sheet's project list holds exactly the board's projects, one entry each,
// labelled with the project's name (never a session's name) and sorted alphabetically, with the
// project of the card on screen preselected, else the most recently updated project; Type
// defaults to Feature.
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, within } from '@testing-library/react'
import { fixTask, installClock, makeTask, specTask } from './fixtures/web-threads-b2.tsx'
import {
  ALPHABETICAL,
  openSheet,
  projectSelect,
  renderDeck,
  selectedProject,
} from './fixtures/launch-session-web.tsx'

vi.mock('../packages/web/src/data.ts', async () =>
  (await import('./fixtures/web-threads-b6.tsx')).dataModule()
)
vi.mock('../packages/web/src/lib/log.ts', async () =>
  (await import('./fixtures/web-threads-b2.tsx')).logModule()
)
vi.mock('../packages/web/src/firebase.ts', () => ({ app: {}, auth: {}, db: {} }))

const optionNames = () =>
  within(projectSelect())
    .getAllByRole('option')
    .map((o) => (o.textContent ?? '').trim())

describe("launch-session 117: the sheet's project and type", () => {
  installClock()

  it("lists exactly the board's projects by name, once each, alphabetically", () => {
    renderDeck([specTask({ projectId: 'p-workshop' })])
    openSheet()
    expect(optionNames()).toEqual(ALPHABETICAL)
  })

  it('never lists a session or task name as a project', () => {
    renderDeck([
      specTask({ projectId: 'p-workshop', title: 'Order the replies' }),
      makeTask('b1', { projectId: 'p-kanban', title: 'Mend the export' }),
    ])
    openSheet()
    const names = optionNames()
    expect(names).not.toContain('Order the replies')
    expect(names).not.toContain('Mend the export')
    expect(names).toHaveLength(4)
  })

  it('preselects the project of the card on screen', () => {
    renderDeck([specTask({ projectId: 'p-workshop' })])
    openSheet()
    expect(selectedProject()).toBe('workshop')
  })

  it('another card on screen preselects its own project', () => {
    renderDeck([specTask({ projectId: 'p-library' })])
    openSheet()
    expect(selectedProject()).toBe('library')
  })

  it('with no card on screen preselects the most recently updated project', () => {
    renderDeck([])
    openSheet()
    expect(selectedProject()).toBe('kanban')
  })

  it('after moving past the top card, preselects the project of the card now on screen', () => {
    renderDeck([specTask({ projectId: 'p-workshop' }), fixTask({ projectId: 'p-library' })])
    const projectOnScreen = () =>
      (screen.getByTestId('deck-card').textContent ?? '').includes('Order the replies')
        ? 'workshop'
        : 'library'
    const first = projectOnScreen()
    fireEvent.click(screen.getByRole('button', { name: 'Later', hidden: true }))
    const second = projectOnScreen()
    expect(second).not.toBe(first)
    openSheet()
    expect(selectedProject()).toBe(second)
  })

  it('Type offers Feature, Bugfix and Chore, with Feature chosen', () => {
    renderDeck([specTask({ projectId: 'p-workshop' })])
    const sheet = openSheet()
    const group = within(sheet).getByRole('radiogroup', { name: 'Type' })
    expect(within(group).getAllByRole('radio')).toHaveLength(3)
    expect(within(group).getByRole('radio', { name: 'Feature' })).toHaveProperty('checked', true)
    expect(within(group).getByRole('radio', { name: 'Bugfix' })).toHaveProperty('checked', false)
    expect(within(group).getByRole('radio', { name: 'Chore' })).toHaveProperty('checked', false)
  })

  it('the sheet is titled New session', () => {
    renderDeck([])
    openSheet()
    expect(screen.getByRole('dialog', { name: 'New session' })).toBeTruthy()
  })
})
