// @vitest-environment jsdom
// swipe-deck 61 (screen): the details sheet of a next card, and starting it with its context.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import Deck from '../packages/web/src/pages/Deck.tsx'
import { relativeTime } from '../packages/web/src/lib/threads.ts'
import { briefText } from './fixtures/swipe-deck-brief.ts'
import {
  MINUTE,
  NOW,
  actions,
  installClock,
  nextTask,
  press,
  renderAt,
  setBoard,
} from './fixtures/web-threads-b2.tsx'

vi.mock('../packages/web/src/data.ts', async () =>
  (await import('./fixtures/web-threads-b2.tsx')).dataModule()
)
vi.mock('../packages/web/src/lib/log.ts', async () =>
  (await import('./fixtures/web-threads-b2.tsx')).logModule()
)
vi.mock('../packages/web/src/firebase.ts', () => ({ app: {}, auth: {}, db: {} }))

const text = (el: HTMLElement) => (el.textContent ?? '').replace(/\s+/g, ' ')
const WHY = 'Night reading hurts'
const summary = (line: string) => `Replies now show in order.\n\n### Suggested next\n${line}`
const PR_URL = 'https://github.com/x/site/pull/42'
const withPr = { pr: { number: 42, url: PR_URL } }

describe('swipe-deck 61 details of a next card', () => {
  installClock()
  beforeEach(() => localStorage.clear())
  const finished = (line: string, body = 'Replies now show in order.') =>
    nextTask({
      summary: `${body}

### Suggested next
${line}`,
      doneAt: NOW - 12 * MINUTE,
      updatedAt: NOW - 12 * MINUTE,
      ...withPr,
    })
  const open = (task = finished(`Add dark mode — ${WHY}`)) => {
    setBoard({ tasks: [task] })
    renderAt('/', <Deck />)
    press('ArrowUp')
    return screen.getByRole('dialog')
  }
  const region = (sheet: HTMLElement, name: string) => within(sheet).getByRole('region', { name })

  it('shows the four regions in order, "Suggested by" with session, project and time', () => {
    const sheet = open()
    const names = ['Suggested by', 'Why', 'What that session finished', 'If you agree']
    const els = names.map((n) => region(sheet, n))
    els
      .slice(1)
      .forEach((el, i) =>
        expect(els[i].compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
      )
    const by = text(els[0])
    expect(by).toContain('Dark mode groundwork')
    expect(by).toContain('kanban')
    expect(by).toContain(relativeTime(NOW - 12 * MINUTE, NOW))
    expect(text(els[1])).toContain(WHY)
  })

  it('has no Why region without one', () => {
    const sheet = open(finished('Add dark mode'))
    expect(within(sheet).queryByRole('region', { name: 'Why' })).toBeNull()
    expect(region(sheet, 'What that session finished')).toBeTruthy()
  })

  it('shows the finished text without the suggestion or markup', () => {
    const t = text(region(open(), 'What that session finished'))
    expect(t).toContain('Replies now show in order.')
    expect(t).not.toContain('Suggested next')
    expect(t).not.toContain('Add dark mode')
    expect(t).not.toContain('###')
  })

  it('shows the parts of a summary brief, without raw heading markup', () => {
    const t = text(
      region(open(finished('Add dark mode', briefText('summary'))), 'What that session finished')
    )
    for (const part of ['You asked for it.', 'It saves time.', 'A small build.'])
      expect(t).toContain(part)
    expect(t).not.toContain('###')
    expect(t).not.toContain('Suggested next')
  })

  it('says exactly what agreeing does', () => {
    expect(text(region(open(), 'If you agree'))).toContain(
      'Queues a task in kanban. The next session there writes a spec, and nothing is built until you confirm it.'
    )
  })

  it("links to the finished session's pull request", () => {
    const link = within(open()).getByRole('link', { name: 'Pull request #42' })
    expect(link.getAttribute('href')).toBe(PR_URL)
  })

  it('has no pull request link without one', () => {
    open(nextTask({ summary: summary('Add dark mode') }))
    expect(screen.queryByRole('link', { name: /Pull request/ })).toBeNull()
  })
})

describe('swipe-deck 61 starting a next card', () => {
  installClock()
  beforeEach(() => localStorage.clear())

  it('queues the what, with the why and the suggesting session in the description', () => {
    setBoard({ tasks: [nextTask({ summary: summary(`Add dark mode — ${WHY}`) })] })
    renderAt('/', <Deck />)
    press('ArrowRight')
    expect(actions.queueSuggestion).toHaveBeenCalledTimes(1)
    const [projectId, what, description] = actions.queueSuggestion.mock.calls[0]
    expect(projectId).toBe('p-kanban')
    expect(what).toBe('Add dark mode')
    expect(description).toContain(WHY)
    expect(description).toContain('Dark mode groundwork')
  })

  it('without a why the description still names the suggesting session', () => {
    setBoard({ tasks: [nextTask({ summary: summary('Add dark mode') })] })
    renderAt('/', <Deck />)
    press('ArrowRight')
    const [, what, description] = actions.queueSuggestion.mock.calls[0]
    expect(what).toBe('Add dark mode')
    expect(description).toContain('Dark mode groundwork')
  })
})
