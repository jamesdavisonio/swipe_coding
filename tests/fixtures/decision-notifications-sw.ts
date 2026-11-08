// Loads packages/web/public/sw.js (a classic script, no imports) into a node:vm context whose
// global is a fake service worker scope, and dispatches fake push / notificationclick events.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import vm from 'node:vm'
import { vi } from 'vitest'

export const ORIGIN = 'https://kanban.example'

export interface FakeClient {
  url: string
  focus: ReturnType<typeof vi.fn>
  postMessage: ReturnType<typeof vi.fn>
}
export const fakeClient = (url: string): FakeClient => ({
  url,
  focus: vi.fn(() => Promise.resolve()),
  postMessage: vi.fn(),
})

export function loadSw(open: FakeClient[] = []) {
  const handlers = new Map<string, ((event: unknown) => void)[]>()
  const scope = {
    addEventListener: (type: string, fn: (event: unknown) => void) =>
      handlers.set(type, [...(handlers.get(type) ?? []), fn]),
    registration: { showNotification: vi.fn((..._args: unknown[]) => Promise.resolve()) },
    clients: {
      matchAll: vi.fn((..._args: unknown[]) => Promise.resolve([...open])),
      openWindow: vi.fn((..._args: unknown[]) => Promise.resolve(null)),
      claim: vi.fn(() => Promise.resolve()),
    },
    skipWaiting: vi.fn(() => Promise.resolve()),
    location: { origin: ORIGIN, href: `${ORIGIN}/sw.js` },
    URL,
    URLSearchParams,
    console,
    self: undefined as unknown,
  }
  scope.self = scope
  vm.createContext(scope)
  const file = join(import.meta.dirname, '..', '..', 'packages', 'web', 'public', 'sw.js')
  vm.runInContext(readFileSync(file, 'utf8'), scope, { filename: 'sw.js' })

  async function dispatch(type: string, event: Record<string, unknown>) {
    const list = handlers.get(type)
    if (!list?.length) throw new Error(`sw.js registers no "${type}" handler`)
    const waiting: Promise<unknown>[] = []
    const full = {
      ...event,
      waitUntil: (p: Promise<unknown>) => void waiting.push(Promise.resolve(p)),
    }
    for (const fn of list) fn(full)
    await Promise.allSettled(waiting)
    return { waited: waiting.length }
  }
  return {
    scope,
    shown: () => scope.registration.showNotification.mock.calls,
    // A push whose body is `payload` (JSON), or no body at all with null.
    push: (payload: unknown) =>
      dispatch('push', { data: payload === null ? null : { json: () => payload } }),
    // A push whose showNotification stays pending until release(): the promises handed to
    // waitUntil are returned with a probe of whether they have settled.
    pushHeld: async (payload: unknown) => {
      let release: () => void = () => {}
      scope.registration.showNotification.mockImplementation(
        () => new Promise<void>((resolve) => (release = resolve))
      )
      const waiting: Promise<unknown>[] = []
      let settled = false
      for (const fn of handlers.get('push') ?? [])
        fn({
          data: { json: () => payload },
          waitUntil: (p: Promise<unknown>) => void waiting.push(Promise.resolve(p)),
        })
      const all = Promise.allSettled(waiting).then(() => void (settled = true))
      await new Promise((r) => setImmediate(r))
      return { waited: waiting.length, settledBeforeRelease: settled, release, done: all }
    },
    // A push whose body is not JSON.
    pushGarbage: () =>
      dispatch('push', {
        data: {
          json: () => {
            throw new SyntaxError('bad json')
          },
        },
      }),
    // A tap on a notification whose stored data is `data`.
    click: async (data: unknown) => {
      const notification = { close: vi.fn(), data }
      const result = await dispatch('notificationclick', { notification })
      return { ...result, notification }
    },
  }
}

// FCM's web payload for a data-only message.
export const fcm = (data: Record<string, unknown>) => ({ data })
export const NOTICE = {
  title: 'Spec · kanban',
  body: 'Start building notifications for decision cards',
  tag: 'decision:t1',
  url: '/?task=t1',
}
