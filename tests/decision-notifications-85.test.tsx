// @vitest-environment jsdom
// decision-notifications 85: tapping a notification with a board tab already open brings that
// tab to the front (sw.js focuses the first same-origin client and posts it
// { type: 'kanban:open-task', taskId }) and the deck shows that task's card first (the app shell
// listens on navigator.serviceWorker and navigates to /?task=<id>).
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import App from '../packages/web/src/App.tsx'
import {
  choiceTask,
  installClock,
  mergeTask,
  setBoard,
  specTask,
} from './fixtures/web-threads-b2.tsx'
import { installPush } from './fixtures/decision-notifications.ts'
import { ORIGIN, fakeClient, loadSw } from './fixtures/decision-notifications-sw.ts'

vi.mock('../packages/web/src/data.ts', async () =>
  (await import('./fixtures/web-threads-b2.tsx')).dataModule()
)
vi.mock('../packages/web/src/lib/log.ts', async () =>
  (await import('./fixtures/web-threads-b2.tsx')).logModule()
)
vi.mock('../packages/web/src/firebase.ts', () => ({ app: {}, auth: {}, db: {} }))
vi.mock('../packages/web/src/auth.tsx', () => ({
  AuthGate: ({ children }: { children: unknown }) => children,
}))
vi.mock('firebase/messaging', async () =>
  (await import('./fixtures/decision-notifications.ts')).messagingModule()
)

const topText = () => (screen.getByTestId('deck-card').textContent ?? '').replace(/\s+/g, ' ')
const message = (data: unknown) => new MessageEvent('message', { data })

describe('decision-notifications 85 tapping with a board tab open', () => {
  it('focuses the first same-origin tab, tells it which task, and opens no window', async () => {
    const other = fakeClient('https://other.example/')
    const first = fakeClient(`${ORIGIN}/`)
    const second = fakeClient(`${ORIGIN}/threads`)
    const sw = loadSw([other, first, second])
    const { notification } = await sw.click({ url: '/?task=choice1' })
    expect(sw.scope.clients.matchAll).toHaveBeenCalledWith({
      type: 'window',
      includeUncontrolled: true,
    })
    expect(first.focus).toHaveBeenCalledTimes(1)
    expect(first.postMessage).toHaveBeenCalledTimes(1)
    expect(first.postMessage).toHaveBeenCalledWith({ type: 'kanban:open-task', taskId: 'choice1' })
    expect(other.focus).not.toHaveBeenCalled()
    expect(other.postMessage).not.toHaveBeenCalled()
    expect(second.focus).not.toHaveBeenCalled()
    expect(second.postMessage).not.toHaveBeenCalled()
    expect(sw.scope.clients.openWindow).not.toHaveBeenCalled()
    expect(notification.close).toHaveBeenCalled()
  })

  it('sends the task id decoded from the url', async () => {
    const tab = fakeClient(`${ORIGIN}/`)
    const sw = loadSw([tab])
    await sw.click({ url: '/?task=a%20b' })
    expect(tab.postMessage).toHaveBeenCalledWith({ type: 'kanban:open-task', taskId: 'a b' })
  })
})

describe('decision-notifications 85 the open board reacts', () => {
  installClock()
  afterEach(cleanup)
  const open = (path: string) => {
    window.history.pushState({}, '', path)
    return render(<App />)
  }
  const board = () => setBoard({ tasks: [specTask(), choiceTask(), mergeTask()] })

  it('a kanban:open-task message puts that task first and shows it in the url', () => {
    board()
    const { container } = installPush()
    open('/')
    expect(topText()).toContain('Order the replies')
    act(() => {
      container.dispatchEvent(message({ type: 'kanban:open-task', taskId: 'choice1' }))
    })
    expect(topText()).toContain('Pick a font')
    expect(window.location.pathname + window.location.search).toBe('/?task=choice1')
  })

  it('also works from another page of the board', () => {
    board()
    const { container } = installPush()
    open('/projects')
    act(() => {
      container.dispatchEvent(message({ type: 'kanban:open-task', taskId: 'merge1' }))
    })
    expect(window.location.pathname + window.location.search).toBe('/?task=merge1')
    expect(topText()).toContain('Merge PR #42 into main')
  })

  it.each([
    ['another message type', { type: 'other', taskId: 'choice1' }],
    ['a message without a task id', { type: 'kanban:open-task' }],
    ['a message that is not an object', 'hello'],
    ['an empty message', null],
  ])('ignores %s', (_name, data) => {
    board()
    const { container } = installPush()
    open('/')
    act(() => {
      container.dispatchEvent(message(data))
    })
    expect(topText()).toContain('Order the replies')
    expect(window.location.search).toBe('')
  })
})
