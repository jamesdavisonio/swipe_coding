// @vitest-environment jsdom
// web-threads shared criterion 30 on the thread view: every control is reachable with Tab and
// has an accessible name; the stage stepper marks the current stage with aria-current="step";
// replying, Read more and Back work from the keyboard. (The visible focus ring is CSS that
// jsdom cannot render; it is checked at review.)
import { describe, expect, it, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent, { type UserEvent } from '@testing-library/user-event'
import { STAGE_LABEL, taskStages, type Task } from '../packages/shared/src/index.ts'
import Thread from '../packages/web/src/pages/Thread.tsx'
import {
  DAY,
  MINUTE,
  NOW,
  installClock,
  isBefore,
  makeTask,
  where,
} from './fixtures/web-threads-b2.tsx'
import {
  b3Actions,
  composer,
  deepest,
  readMoreButtons,
  renderThread,
  sessionMsg,
  setThread,
  jamesMsg,
} from './fixtures/web-threads-b3.tsx'

vi.mock('../packages/web/src/data.ts', async () =>
  (await import('./fixtures/web-threads-b3.tsx')).dataModule()
)
vi.mock('../packages/web/src/lib/log.ts', async () =>
  (await import('./fixtures/web-threads-b2.tsx')).logModule()
)
vi.mock('../packages/web/src/components/DecisionSheet.tsx', async () =>
  (await import('./fixtures/web-threads-b2.tsx')).sheetModule()
)
vi.mock('../packages/web/src/components/HistorySheet.tsx', async () =>
  (await import('./fixtures/web-threads-b3.tsx')).historyModule()
)
vi.mock('../packages/web/src/firebase.ts', () => ({ app: {}, auth: {}, db: {} }))

// A question with options: header, stepper, a message Read more, quick replies and composer.
const font = makeTask('t1', {
  projectId: 'p-site',
  title: 'Pick a font',
  stage: 'build',
  working: true,
  needs: {
    kind: 'question',
    question: 'Which font?',
    options: [
      { key: 'A', label: 'Inter' },
      { key: 'B', label: 'Atkinson' },
    ],
  },
})
const LAST = 'Either works for me'
const comments = [
  sessionMsg('c1', 'system', 'Task created', NOW - 2 * DAY),
  sessionMsg('c2', 'question', 'Which font should we use?', NOW - 30 * MINUTE),
  jamesMsg('c3', LAST, NOW - 10 * MINUTE),
]

const open = (task: Task = font) => {
  setThread(task, { comments })
  renderThread('/t/t1', <Thread />)
  return userEvent.setup()
}

const controls = () =>
  Array.from(
    document.body.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]'
    )
  ).filter((el) => el.getAttribute('tabindex') !== '-1')

async function tabTo(user: UserEvent, target: HTMLElement) {
  for (let i = 0; i < 60 && document.activeElement !== target; i++) await user.tab()
  expect(document.activeElement).toBe(target)
}

const stepper = () => screen.getByRole('list', { name: 'Stages' })
const currentSteps = () => stepper().querySelectorAll('[aria-current="step"]')

describe('B3-30 keyboard and names on the thread', () => {
  installClock()

  it('reaches every control with Tab', async () => {
    const user = open()
    const reached = new Set<Element>()
    for (let i = 0; i < 60; i++) {
      await user.tab()
      const el = document.activeElement
      if (!el || el === document.body || reached.has(el)) break
      reached.add(el)
    }
    const all = controls()
    // Back, Decision history, a message Read more, 2 options + Read more, the textbox.
    expect(all.length).toBeGreaterThanOrEqual(7)
    expect(all.filter((el) => !reached.has(el)).map((el) => el.outerHTML)).toEqual([])
  })

  it('gives every button, link and textbox an accessible name', () => {
    open()
    expect(screen.queryAllByRole('button', { name: '' })).toEqual([])
    expect(screen.queryAllByRole('link', { name: '' })).toEqual([])
    expect(screen.queryAllByRole('textbox', { name: '' })).toEqual([])
    expect(composer()).toBeTruthy()
  })

  it('types and sends a reply with the keyboard alone', async () => {
    const user = open()
    await tabTo(user, composer())
    await user.keyboard('Go with Inter{Control>}{Enter}{/Control}')
    expect(b3Actions.sendReply).toHaveBeenCalledTimes(1)
    expect(b3Actions.sendReply.mock.calls[0][1].body.trim()).toBe('Go with Inter')
  })

  it("opens the message's Read more with the keyboard", async () => {
    const user = open()
    const onMessage = readMoreButtons().filter((b) => isBefore(b, deepest(LAST)))
    expect(onMessage).toHaveLength(1)
    await tabTo(user, onMessage[0])
    await user.keyboard('{Enter}')
    const sheet = screen.getByRole('dialog', { name: 'Decision sheet' })
    expect(sheet.textContent).toContain('sheet read: Pick a font')
  })

  it('goes back to Threads with the keyboard', async () => {
    const user = open()
    await tabTo(user, screen.getByRole('button', { name: 'Back to threads' }))
    await user.keyboard('{Enter}')
    expect(where()).toBe('/')
  })

  it('opens Decision history with the keyboard', async () => {
    const user = open()
    await tabTo(user, screen.getByRole('button', { name: 'Decision history' }))
    await user.keyboard('{Enter}')
    expect(screen.getByRole('dialog', { name: 'History sheet' })).toBeTruthy()
  })
})

describe('B3-30 stage stepper', () => {
  installClock()

  it.each([
    ['a feature', font],
    ['a feature with after-deploy steps', { ...font, afterDeploy: ['Open the site'] }],
    [
      'a bugfix',
      makeTask('t1', { type: 'bugfix', title: 'Fix the header', stage: 'pr', needs: null }),
    ],
    ['a chore', makeTask('t1', { type: 'chore', title: 'Tidy up', stage: 'do' })],
  ])('lists every stage of %s and marks the current one', (_name, task) => {
    open(task)
    const items = within(stepper()).getAllByRole('listitem')
    const chain = taskStages(task)
    expect(items).toHaveLength(chain.length)
    chain.forEach((stage, i) => expect(items[i].textContent).toContain(STAGE_LABEL[stage]))
    const current = currentSteps()
    expect(current).toHaveLength(1)
    const item = items[chain.indexOf(task.stage)]
    expect(item === current[0] || item.contains(current[0])).toBe(true)
  })

  it.each([
    ['a done task', makeTask('t1', { ...font, stage: 'done', needs: null, doneAt: NOW - DAY })],
    ['a stage outside its chain', makeTask('t1', { type: 'bugfix', stage: 'spec' })],
  ])('marks no stage current for %s', (_name, task) => {
    open(task)
    expect(within(stepper()).getAllByRole('listitem')).toHaveLength(taskStages(task).length)
    expect(currentSteps()).toHaveLength(0)
  })

  it('renders no stepper for a for_james task', () => {
    open(makeTask('t1', { type: 'for_james', title: 'For James', stage: 'do' }))
    expect(screen.getByRole('heading', { name: 'For James' })).toBeTruthy()
    expect(screen.queryByRole('list', { name: 'Stages' })).toBeNull()
    expect(document.querySelectorAll('[aria-current="step"]')).toHaveLength(0)
  })
})
