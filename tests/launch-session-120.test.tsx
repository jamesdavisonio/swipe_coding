// @vitest-environment jsdom
// launch-session 120: dictation in the idea box appends what James says to the text (it never
// repeats a phrase it already wrote, as fixed for the voice note), and listens until James taps
// stop (a run the browser ends by itself starts again).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, screen } from '@testing-library/react'
import { NOW, specTask } from './fixtures/web-threads-b2.tsx'
import {
  FakeRecognition,
  installRecognition,
  sheetWords,
  uninstallRecognition,
} from './fixtures/fake-recognition.ts'
import {
  ideaField,
  openSheet,
  renderDeck,
  squash,
  typeIdea,
} from './fixtures/launch-session-web.tsx'

vi.mock('../packages/web/src/data.ts', async () =>
  (await import('./fixtures/web-threads-b6.tsx')).dataModule()
)
vi.mock('../packages/web/src/lib/log.ts', async () =>
  (await import('./fixtures/web-threads-b2.tsx')).logModule()
)
vi.mock('../packages/web/src/firebase.ts', () => ({ app: {}, auth: {}, db: {} }))

beforeEach(() => {
  localStorage.clear()
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
  installRecognition()
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  uninstallRecognition()
})

const wait = (ms: number) => act(() => void vi.advanceTimersByTime(ms))
const dictate = () => {
  renderDeck([specTask({ projectId: 'p-workshop' })])
  openSheet()
  fireEvent.click(screen.getByRole('button', { name: 'Start talking' }))
  return FakeRecognition.current()
}
// While listening the idea is the "Stop and edit the text" button; otherwise the text box.
const idea = () => squash(sheetWords())

describe('launch-session 120: dictating the idea', () => {
  it('the Start talking button starts listening and becomes Stop listening', () => {
    const r = dictate()
    expect(r.start).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Stop listening' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Start talking' })).toBeNull()
  })

  it('puts what James says in the idea box', () => {
    const r = dictate()
    r.say('search by title', true)
    expect(idea()).toBe('search by title')
  })

  it('appends to the text already there instead of replacing it', () => {
    renderDeck([specTask({ projectId: 'p-workshop' })])
    openSheet()
    typeIdea('Add a search page.')
    fireEvent.click(screen.getByRole('button', { name: 'Add more' }))
    FakeRecognition.current().say('It should be fast', true)
    expect(idea()).toBe('Add a search page. It should be fast')
  })

  it('never repeats a phrase it already wrote (Android results that extend each other)', () => {
    const r = dictate()
    r.sayResults([
      ['search by', false],
      ['search by title', false],
      ['search by title and project', false],
    ])
    expect(idea()).toBe('search by title and project')
    r.sayResults([
      ['search by title and project', true],
      ['search by title and project now', true],
    ])
    expect(idea()).toBe('search by title and project now')
  })

  it('joins separate segments in order (desktop)', () => {
    const r = dictate()
    r.sayResults([
      ['search by title', true],
      [' and project', true],
    ])
    expect(idea()).toBe('search by title and project')
  })

  it('listens until James taps stop: a run the browser ends starts again, keeping the words', () => {
    const r = dictate()
    r.say('search by title', true)
    r.endByItself()
    expect(screen.getByRole('button', { name: 'Stop listening' })).toBeTruthy()
    wait(1000)
    expect(FakeRecognition.starts()).toBe(2)
    FakeRecognition.current().say('and by project', true)
    expect(idea()).toBe('search by title and by project')
  })

  it('tapping Stop listening stops it for good and keeps the words', () => {
    const r = dictate()
    r.say('search by title', true)
    fireEvent.click(screen.getByRole('button', { name: 'Stop listening' }))
    expect(
      FakeRecognition.all.some((x) => x.stop.mock.calls.length + x.abort.mock.calls.length > 0)
    ).toBe(true)
    expect(screen.getByRole('button', { name: 'Add more' })).toBeTruthy()
    wait(60_000)
    expect(FakeRecognition.starts()).toBe(1)
    expect(idea()).toBe('search by title')
  })

  it('dictating again after a stop keeps the earlier phrase exactly once', () => {
    const r = dictate()
    r.say('search by title', true)
    fireEvent.click(screen.getByRole('button', { name: 'Stop listening' }))
    fireEvent.click(screen.getByRole('button', { name: 'Add more' }))
    FakeRecognition.current().say('and by project', true)
    expect(idea()).toBe('search by title and by project')
    fireEvent.click(screen.getByRole('button', { name: 'Stop listening' }))
    typeIdea(ideaField().value + ' please')
    fireEvent.click(screen.getByRole('button', { name: 'Add more' }))
    FakeRecognition.current().sayResults([
      ['now', false],
      ['now quickly', false],
    ])
    expect(idea()).toBe('search by title and by project please now quickly')
  })

  it('the words stay editable: typing after dictating changes the box', () => {
    const r = dictate()
    r.say('search by title', true)
    fireEvent.click(screen.getByRole('button', { name: 'Stop listening' }))
    typeIdea('search by title, then project')
    expect(ideaField().value).toBe('search by title, then project')
  })
})
