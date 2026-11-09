// Shared setup for the launch-session web suites (tests/launch-session-11x.test.tsx, 120): the real
// Deck with the mocked data layer of the earlier B2-B6 fixtures (createTask is the B5 spy) and a
// board whose projects are named the way the board stores them (folder names), deliberately not
// in alphabetical order and with distinct updatedAt, so the project list's order and its default
// are decided by the sheet, not by the order the data arrives in.
//
// Each suite wires the mocks itself (vi.mock is hoisted per test file):
//   vi.mock('../packages/web/src/data.ts', async () =>
//     (await import('./fixtures/web-threads-b6.tsx')).dataModule())
//   vi.mock('../packages/web/src/lib/log.ts', async () =>
//     (await import('./fixtures/web-threads-b2.tsx')).logModule())
//   vi.mock('../packages/web/src/firebase.ts', () => ({ app: {}, auth: {}, db: {} }))
import { fireEvent, screen } from '@testing-library/react'
import type { Project, Task } from '../../packages/shared/src/index.ts'
import Deck from '../../packages/web/src/pages/Deck.tsx'
import { HOUR, NOW, renderAt } from './web-threads-b2.tsx'
import { b5Actions, setB5Board } from './web-threads-b5.tsx'

const project = (id: string, name: string, updatedAgo: number): Project => ({
  id,
  hostname: 'desk-pc',
  cwd: `C:/code/${name}`,
  name,
  createdAt: NOW - 30 * 24 * HOUR,
  updatedAt: NOW - updatedAgo,
})

// workshop is the project of the card on screen in the suites; kanban was updated last (it is
// neither first nor last alphabetically, so a default of "first option" cannot pass).
export const LAUNCH_PROJECTS: Project[] = [
  project('p-workshop', 'workshop', 5 * HOUR),
  project('p-trackers', 'data-trackers', 3 * HOUR),
  project('p-kanban', 'kanban', 1 * HOUR),
  project('p-library', 'library', 4 * HOUR),
]
export const ALPHABETICAL = ['data-trackers', 'kanban', 'library', 'workshop']

export const createTask = b5Actions.createTask

// Loads the board and renders the deck.
export function renderDeck(tasks: Task[] = [], projects: Project[] = LAUNCH_PROJECTS) {
  setB5Board({ tasks, projects })
  return renderAt('/', <Deck />)
}

export const newSessionButton = () => screen.getByRole('button', { name: 'New session' })
export const openSheet = () => {
  fireEvent.click(newSessionButton())
  return screen.getByRole('dialog', { name: 'New session' })
}
export const sheetOpen = () => screen.queryByRole('dialog', { name: 'New session' }) !== null

export const projectSelect = () =>
  screen.getByRole<HTMLSelectElement>('combobox', { name: 'Project' })
export const nameField = () => screen.getByRole<HTMLInputElement>('textbox', { name: 'Name' })
export const ideaField = () =>
  screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'The idea' })
export const startButton = () => screen.getByRole('button', { name: 'Start session' })

export const typeName = (text: string) => fireEvent.change(nameField(), { target: { value: text } })
export const typeIdea = (text: string) => fireEvent.change(ideaField(), { target: { value: text } })
export const selectedProject = () => projectSelect().selectedOptions[0]?.textContent ?? ''
export const toastText = () => screen.getByRole('status').textContent ?? ''
export const squash = (s: string) => s.replace(/\s+/g, ' ').trim()
