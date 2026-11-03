// @vitest-environment jsdom
// web-threads B3, criterion 13: the thread renders its messages in order — system lines with
// their text only, session messages labelled by kind, James's messages with time and tick
// label — the latest session message of the needed kind carries Read more, a typing status
// shows while the session works, and opening an unread thread marks it read.
import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Thread from '../packages/web/src/pages/Thread.tsx'
import {
  DAY,
  HOUR,
  MINUTE,
  NOW,
  installClock,
  isBefore,
  makeTask,
} from './fixtures/web-threads-b2.tsx'
import {
  actions,
  deepest,
  firstOf,
  jamesMsg,
  pushThread,
  readMoreButtons,
  renderThread,
  sessionMsg,
  setThread,
  textAfter,
  threadText,
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

const question = makeTask('t1', {
  projectId: 'p-site',
  title: 'Pick a font',
  stage: 'build',
  working: true,
  needs: {
    kind: 'question',
    question: 'Which weight?',
    options: [
      { key: 'A', label: 'Regular' },
      { key: 'B', label: 'Bold' },
    ],
  },
})

const BODIES = [
  'Task created from the board',
  'Spec v1: two font families',
  'Looks good to me',
  'Which family should we use?',
  'Which weight, regular or bold?',
  'Trying both in the preview',
  'Bold please',
] as const
const conversation = [
  sessionMsg('c1', 'system', BODIES[0], NOW - 3 * DAY),
  sessionMsg('c2', 'spec', BODIES[1], NOW - 2 * DAY),
  jamesMsg('c3', BODIES[2], NOW - DAY - HOUR, { deliveredAt: NOW - DAY }),
  sessionMsg('c4', 'question', BODIES[3], NOW - 50 * MINUTE),
  sessionMsg('c5', 'question', BODIES[4], NOW - 40 * MINUTE),
  sessionMsg('c6', 'info', BODIES[5], NOW - 30 * MINUTE),
  jamesMsg('c7', BODIES[6], NOW - 12 * MINUTE, {
    kind: 'answer',
    deliveredAt: NOW - 11 * MINUTE,
    handledAt: NOW - 5 * MINUTE,
  }),
]

const open = (task = question, comments = conversation) => {
  setThread(task, { comments })
  renderThread('/t/t1', <Thread />)
  return userEvent.setup()
}
const working = () => screen.queryByRole('status', { name: 'Session is working' })
// Any message kind label, "<Kind> · <time>" (James's kinds included, should one leak through).
const KIND_LABEL = /\b(Spec|Question|PR ready|After deploy|Done|Session|System|Comment|Answer) ·/
// The page text without the Stages stepper (its own separators are not message labels), the
// composer's contents or the location probe, from `start` up to `until` (or the end).
function conversationAfter(start: string, until?: string): string {
  const skip = 'textarea, [data-testid="location"]'
  const stepper = screen.queryByRole('list', { name: 'Stages' })
  const parts: string[] = []
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.parentElement?.closest(skip) || stepper?.contains(node)) continue
    parts.push(node.textContent ?? '')
  }
  const all = parts.join(' ').replace(/\s+/g, ' ')
  const from = all.indexOf(start)
  if (from < 0) throw new Error(`"${start}" is not on screen`)
  const rest = all.slice(from + start.length)
  const end = until === undefined ? -1 : rest.indexOf(until)
  return end < 0 ? rest : rest.slice(0, end)
}

describe('B3-13 messages', () => {
  installClock()

  it('renders every message in createdAt order', () => {
    open()
    const nodes = BODIES.map((body) => deepest(body))
    for (let i = 1; i < nodes.length; i++) expect(isBefore(nodes[i - 1], nodes[i])).toBe(true)
  })

  it('a system line shows its text only, with no kind label or time', () => {
    open()
    expect(threadText()).toContain(BODIES[0])
    expect(threadText()).not.toContain('3 d')
    expect(textAfter(BODIES[0], BODIES[1])).not.toMatch(/Session ·|System/)
    // Nor above it: nothing between the header line and the system body is a kind label.
    expect(conversationAfter('website · Question for you', BODIES[0])).not.toMatch(KIND_LABEL)
  })

  it('labels session messages "<Kind> · <relative time>"', () => {
    open()
    const text = threadText()
    expect(text).toContain('Spec · 2 d')
    expect(text).toContain('Question · 50 min')
    expect(text).toContain('Question · 40 min')
    expect(text).toContain('Session · 30 min')
  })

  it.each([
    ['pr', 'PR ready · 4 d', 4 * DAY],
    ['after_deploy', 'After deploy · 3 d', 3 * DAY],
    ['done', 'Done · 2 d', 2 * DAY],
    ['info', 'Session · 50 min', 50 * MINUTE],
    ['mystery_kind', 'Session · 30 min', 30 * MINUTE],
  ])('a %s message is labelled "%s"', (kind, label, age) => {
    const quiet = makeTask('t1', { title: 'Ship the footer', stage: 'main_ci' })
    open(quiet, [sessionMsg('m', kind, 'Something from the session', NOW - age)])
    expect(threadText()).toContain(label)
  })

  it("shows James's messages with their relative time and a tick label for each delivery state", () => {
    const sent = jamesMsg('j1', 'First reply', NOW - 40 * MINUTE)
    const received = jamesMsg('j2', 'Second reply', NOW - 30 * MINUTE, {
      deliveredAt: NOW - 29 * MINUTE,
    })
    const workingOn = jamesMsg('j3', 'Third reply', NOW - 20 * MINUTE, {
      deliveredAt: NOW - 19 * MINUTE,
      workingAt: NOW - 18 * MINUTE,
    })
    const handled = jamesMsg('j4', 'Fourth reply', NOW - 10 * MINUTE, {
      kind: 'answer',
      deliveredAt: NOW - 9 * MINUTE,
      workingAt: NOW - 8 * MINUTE,
      handledAt: NOW - 7 * MINUTE,
    })
    open(makeTask('t1', { title: 'Build the cache', stage: 'build' }), [
      sent,
      received,
      workingOn,
      handled,
    ])
    // Fidelity round 1 (B3): James's relative time and tick label sit below his body.
    const first = textAfter('First reply', 'Second reply')
    expect(first).toContain('40 min')
    expect(first).toMatch(/\bsent\b/)
    expect(first).not.toMatch(/received|working on it|handled/)
    const second = textAfter('Second reply', 'Third reply')
    expect(second).toContain('30 min')
    expect(second).toContain('received')
    expect(second).not.toMatch(/\bsent\b|working on it|handled/)
    const third = textAfter('Third reply', 'Fourth reply')
    expect(third).toContain('20 min')
    expect(third).toContain('working on it')
    expect(third).not.toMatch(/\bsent\b|received|handled/)
    const fourth = textAfter('Fourth reply')
    expect(fourth).toContain('10 min')
    expect(fourth).toContain('handled')
    // James's messages (the answer included) carry no kind label, above or below the body.
    expect(conversationAfter('kanban · Building')).not.toMatch(KIND_LABEL)
  })
})

describe('B3-13 Read more on the latest message of the needed kind', () => {
  installClock()

  // Read more buttons in the message list: the quick replies (which also offer Read more for a
  // question) sit in the composer area, after the last message.
  const inMessages = (lastBody: string) =>
    readMoreButtons().filter((button) => isBefore(button, deepest(lastBody)))

  it('only the latest question carries Read more when the task waits on a question', () => {
    open()
    const onMessages = inMessages(BODIES[6])
    expect(onMessages).toHaveLength(1)
    const latest = firstOf(deepest(BODIES[4]), deepest('Question · 40 min'))
    expect(isBefore(deepest(BODIES[3]), onMessages[0])).toBe(true)
    expect(isBefore(latest, onMessages[0])).toBe(true)
    expect(isBefore(onMessages[0], deepest(BODIES[5]))).toBe(true)
  })

  it('only the latest spec carries Read more when the task waits on the spec', () => {
    const spec = makeTask('t1', { title: 'Spec the search', needs: { kind: 'spec' } })
    open(spec, [
      sessionMsg('s1', 'spec', 'Spec version one', NOW - 2 * DAY),
      sessionMsg('q1', 'question', 'An old question', NOW - DAY),
      sessionMsg('s2', 'spec', 'Spec version two', NOW - 50 * MINUTE),
      sessionMsg('i1', 'info', 'Waiting on you', NOW - 10 * MINUTE),
    ])
    const onMessages = inMessages('Waiting on you')
    expect(onMessages).toHaveLength(1)
    expect(isBefore(deepest('An old question'), onMessages[0])).toBe(true)
    expect(
      isBefore(firstOf(deepest('Spec version two'), deepest('Spec · 50 min')), onMessages[0])
    ).toBe(true)
  })

  it('opens the decision sheet in read mode from the message', async () => {
    const steps = makeTask('t1', {
      title: 'Check the deploy',
      stage: 'after_deploy',
      afterDeploy: ['Open the site', 'Sign in'],
      needs: { kind: 'after_deploy' },
    })
    const user = open(steps, [
      sessionMsg('a1', 'after_deploy', 'Two steps for you', NOW - 50 * MINUTE),
      sessionMsg('i1', 'info', 'Deployed to production', NOW - 10 * MINUTE),
    ])
    const buttons = readMoreButtons()
    expect(buttons).toHaveLength(1)
    expect(isBefore(deepest('Two steps for you'), buttons[0])).toBe(true)
    await user.click(buttons[0])
    const sheet = screen.getByRole('dialog', { name: 'Decision sheet' })
    expect(sheet.textContent).toContain('sheet read: Check the deploy')
  })

  it('no message carries Read more when the task needs nothing', () => {
    open(makeTask('t1', { title: 'Build the cache', stage: 'build' }), [
      sessionMsg('s1', 'spec', 'The spec', NOW - DAY),
      sessionMsg('q1', 'question', 'A question', NOW - 50 * MINUTE),
    ])
    expect(readMoreButtons()).toEqual([])
  })
})

describe('B3-13 typing indicator', () => {
  installClock()

  it('shows "Session is working" after the last message while the task is working', () => {
    open()
    const status = working()
    expect(status).toBeTruthy()
    expect(isBefore(deepest(BODIES[6]), status as HTMLElement)).toBe(true)
  })

  it('shows no typing status while the task is not working', () => {
    open({ ...question, working: false })
    expect(working()).toBeNull()
  })

  it('appears and disappears as snapshots change working', () => {
    open({ ...question, working: false })
    pushThread({ task: { ...question, working: true } })
    expect(working()).toBeTruthy()
    pushThread({ task: { ...question, working: false } })
    expect(working()).toBeNull()
  })
})

describe('B3-13 unread', () => {
  installClock()

  it('marks an unread thread read once when it opens', () => {
    open({ ...question, unread: true })
    expect(actions.markRead).toHaveBeenCalledTimes(1)
    expect(actions.markRead).toHaveBeenCalledWith(expect.objectContaining({ id: 't1' }))
    pushThread({ comments: [...conversation, sessionMsg('c8', 'info', 'More', NOW)] })
    expect(actions.markRead).toHaveBeenCalledTimes(1)
  })

  it('does not mark a read thread', () => {
    open({ ...question, unread: false })
    expect(actions.markRead).not.toHaveBeenCalled()
  })

  it('marks it read again when a session message arrives while James reads', () => {
    open({ ...question, unread: true })
    pushThread({ task: { ...question, unread: false } })
    expect(actions.markRead).toHaveBeenCalledTimes(1)
    pushThread({
      task: { ...question, unread: true, updatedAt: NOW },
      comments: [...conversation, sessionMsg('c8', 'info', 'A new message', NOW)],
    })
    expect(actions.markRead).toHaveBeenCalledTimes(2)
  })
})
