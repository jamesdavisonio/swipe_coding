// @vitest-environment jsdom
// decision-notifications 84: tapping a decision notification with no board tab open opens the
// board (sw.js: clients.openWindow) on the deck with that task's card first, then the rest in
// their usual order. Also the worker's push handling: it shows the notice with its tag and treats
// the payload as untrusted (strings only, same-origin path urls).
import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import Deck from '../packages/web/src/pages/Deck.tsx'
import { buildDeck, taskFirst } from '../packages/web/src/lib/deck.ts'
import {
  NOW,
  PROJECTS,
  choiceTask,
  fixTask,
  installClock,
  mergeTask,
  renderAt,
  setBoard,
  specTask,
} from './fixtures/web-threads-b2.tsx'
import { NOTICE, fakeClient, fcm, loadSw } from './fixtures/decision-notifications-sw.ts'

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

const tasks = () => [specTask(), fixTask(), choiceTask(), mergeTask()]
const cards = () =>
  buildDeck({
    tasks: tasks(),
    projects: PROJECTS,
    specBodies: {},
    handledNext: [],
    passed: [],
    now: NOW,
  })
const topText = () => (screen.getByTestId('deck-card').textContent ?? '').replace(/\s+/g, ' ')

describe('decision-notifications 84 tapping with no board open', () => {
  it('opens a window on the notification url', async () => {
    const sw = loadSw([])
    const { notification } = await sw.click({ url: '/?task=t1' })
    expect(sw.scope.clients.matchAll).toHaveBeenCalledWith({
      type: 'window',
      includeUncontrolled: true,
    })
    expect(sw.scope.clients.openWindow).toHaveBeenCalledTimes(1)
    expect(sw.scope.clients.openWindow).toHaveBeenCalledWith('/?task=t1')
    expect(notification.close).toHaveBeenCalled()
  })

  it('a window of another origin does not count as the board', async () => {
    const stranger = fakeClient('https://other.example/?task=t1')
    const sw = loadSw([stranger])
    await sw.click({ url: '/?task=t1' })
    expect(stranger.focus).not.toHaveBeenCalled()
    expect(stranger.postMessage).not.toHaveBeenCalled()
    expect(sw.scope.clients.openWindow).toHaveBeenCalledWith('/?task=t1')
  })
})

describe('decision-notifications 84 the deck opens on that task', () => {
  installClock()

  it('puts that task first and the rest in their usual order (taskFirst)', () => {
    const all = cards()
    const usual = all.map((c) => c.id)
    expect(usual.length).toBe(4)
    const choice = all.find((c) => c.taskId === 'choice1')
    const result = taskFirst(all, 'choice1')
    expect(result[0]).toBe(choice)
    expect(result.slice(1).map((c) => c.id)).toEqual(usual.filter((id) => id !== choice?.id))
    expect(all.map((c) => c.id)).toEqual(usual)
  })

  it('opened at /?task=<id> the deck shows that task card first', () => {
    setBoard({ tasks: tasks() })
    renderAt('/?task=choice1', <Deck />)
    expect(topText()).toContain('Pick a font')
  })

  it('a task of a kind that is usually last still comes first', () => {
    setBoard({ tasks: tasks() })
    renderAt('/?task=merge1', <Deck />)
    expect(topText()).toContain('Merge PR #42 into main')
  })

  it('without the parameter the deck keeps its usual order', () => {
    setBoard({ tasks: tasks() })
    renderAt('/', <Deck />)
    expect(topText()).toContain('Order the replies')
  })
})

describe('decision-notifications 84 the worker shows what it is sent', () => {
  it('shows the title with body, tag, renotify and the url to open', async () => {
    const sw = loadSw()
    await sw.push(fcm(NOTICE))
    expect(sw.shown()).toHaveLength(1)
    const [title, options] = sw.shown()[0] as [string, Record<string, unknown>]
    expect(title).toBe(NOTICE.title)
    expect(options).toMatchObject({
      body: NOTICE.body,
      tag: NOTICE.tag,
      renotify: true,
      data: { url: NOTICE.url },
    })
  })

  it('the notification is shown inside waitUntil: it settles only once showNotification does', async () => {
    const sw = loadSw()
    const held = await sw.pushHeld(fcm(NOTICE))
    expect(sw.shown()).toHaveLength(1)
    expect(held.waited).toBeGreaterThan(0)
    expect(held.settledBeforeRelease).toBe(false)
    held.release()
    await held.done
  })

  it.each([
    ['a cross-origin url', 'https://evil.example/?task=t1'],
    ['a protocol-relative url', '//evil.example/?task=t1'],
    ['a script url', 'javascript:alert(1)'],
    ['a relative url without a slash', 'task=t1'],
    ['a non-string url', 42],
    ['an object url', { href: '/x' }],
    ['no url', undefined],
  ])('%s falls back to /', async (_name, url) => {
    const sw = loadSw()
    await sw.push(fcm({ ...NOTICE, url }))
    expect(sw.shown()).toHaveLength(1)
    expect((sw.shown()[0][1] as { data: { url: string } }).data.url).toBe('/')
  })

  it('a same-origin path with a query is kept', async () => {
    const sw = loadSw()
    await sw.push(fcm({ ...NOTICE, url: '/?task=abc%20d' }))
    expect((sw.shown()[0][1] as { data: { url: string } }).data.url).toBe('/?task=abc%20d')
  })

  it.each([
    ['a non-string title', { title: 7 }],
    ['an empty title', { title: '' }],
    ['a missing title', { title: undefined }],
    ['a non-string body', { body: { text: 'x' } }],
    ['an empty body', { body: '' }],
    ['a missing tag', { tag: undefined }],
    ['a non-string tag', { tag: ['decision:t1'] }],
  ])('shows nothing for %s', async (_name, patch) => {
    const sw = loadSw()
    await sw.push(fcm({ ...NOTICE, ...patch }))
    expect(sw.shown()).toHaveLength(0)
  })

  it.each([
    ['a payload without data', { notification: { title: 'x' } }],
    ['a payload that is not an object', 'hello'],
    ['no body', null],
  ])('shows nothing for %s and does not throw', async (_name, payload) => {
    const sw = loadSw()
    await expect(sw.push(payload)).resolves.toBeDefined()
    expect(sw.shown()).toHaveLength(0)
  })

  it('shows nothing for a body that is not JSON', async () => {
    const sw = loadSw()
    await expect(sw.pushGarbage()).resolves.toBeDefined()
    expect(sw.shown()).toHaveLength(0)
  })
})
