// @vitest-environment jsdom
// web-threads B3, criterion 14: James replies from the composer. Enter is a newline, Ctrl/⌘+Enter
// or Send sends, blank text never sends; the reply goes through sendReply (which picks answer vs
// comment from the task's need) under a client-generated id, shows at once with one tick and
// only once; quick replies sit in the composer area while the task needs James; a done task
// has no composer.
import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Task } from '../packages/shared/src/index.ts'
import Thread from '../packages/web/src/pages/Thread.tsx'
import {
  DAY,
  MINUTE,
  NOW,
  installClock,
  isBefore,
  logSpy,
  makeTask,
  where,
} from './fixtures/web-threads-b2.tsx'
import {
  actions,
  b3Actions,
  composer,
  deepest,
  jamesMsg,
  occurrences,
  pendingWrite,
  pushThread,
  queryComposer,
  renderThread,
  sendButton,
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

const quiet = makeTask('t1', { title: 'Build the cache', stage: 'build' })
const question = makeTask('t1', {
  projectId: 'p-site',
  title: 'Pick a font',
  stage: 'build',
  needs: {
    kind: 'question',
    question: 'Which font?',
    options: [
      { key: 'A', label: 'Inter' },
      { key: 'B', label: 'Atkinson' },
    ],
  },
})
const history = [sessionMsg('c1', 'info', 'Started on the cache', NOW - 30 * MINUTE)]

const open = (task: Task = quiet) => {
  setThread(task, { comments: history })
  renderThread('/t/t1', <Thread />)
  return userEvent.setup()
}
const sentWith = () => b3Actions.sendReply.mock.calls[0]
const isDisabled = (el: HTMLElement) => (el as HTMLButtonElement).disabled

describe('B3-14 composer keys', () => {
  installClock()

  it('has a labelled textbox and a Send button that is disabled while empty', () => {
    open()
    expect((composer() as HTMLTextAreaElement).value).toBe('')
    expect(isDisabled(sendButton())).toBe(true)
  })

  it('Enter inserts a newline and does not send', async () => {
    const user = open()
    await user.click(composer())
    await user.keyboard('First line{Enter}second line')
    expect((composer() as HTMLTextAreaElement).value).toBe('First line\nsecond line')
    expect(b3Actions.sendReply).not.toHaveBeenCalled()
    expect(isDisabled(sendButton())).toBe(false)
  })

  it.each([
    ['Ctrl+Enter', '{Control>}{Enter}{/Control}'],
    ['⌘+Enter', '{Meta>}{Enter}{/Meta}'],
  ])('%s sends', async (_name, keys) => {
    const user = open()
    await user.click(composer())
    await user.keyboard(`Ship it${keys}`)
    expect(b3Actions.sendReply).toHaveBeenCalledTimes(1)
    expect(sentWith()[1].body.trim()).toBe('Ship it')
  })

  it('the Send button sends, keeping inner newlines', async () => {
    const user = open()
    await user.click(composer())
    await user.keyboard('One{Enter}two')
    await user.click(sendButton())
    expect(b3Actions.sendReply).toHaveBeenCalledTimes(1)
    expect(sentWith()[1].body.trim()).toBe('One\ntwo')
  })

  it.each([
    ['spaces', '   '],
    ['newlines and spaces', '{Enter}  {Enter}'],
  ])('whitespace-only text (%s) cannot be sent', async (_name, keys) => {
    const user = open()
    await user.click(composer())
    await user.keyboard(keys)
    await user.click(composer())
    await user.keyboard('{Control>}{Enter}{/Control}')
    expect(isDisabled(sendButton())).toBe(true)
    await user.click(sendButton())
    expect(b3Actions.sendReply).not.toHaveBeenCalled()
    expect(threadText()).not.toMatch(/\bsent\b/)
  })
})

describe('B3-14 sending', () => {
  installClock()

  it.each([
    ['a question (the write is an answer)', question],
    ['no need (the write is a comment)', quiet],
  ] as const)(
    'with %s, sends the reply for that task under a fresh comment id',
    async (_name, task) => {
      const user = open(task)
      await user.click(composer())
      await user.keyboard('  Use Inter  ')
      await user.click(sendButton())
      expect(b3Actions.newCommentId).toHaveBeenCalled()
      const [sentTask, reply] = sentWith()
      expect(sentTask).toEqual(expect.objectContaining({ id: 't1', needs: task.needs }))
      const issued = b3Actions.newCommentId.mock.results.map((r) => r.value as unknown)
      expect(issued).toContain(reply.id)
      expect(reply.body.trim()).toBe('Use Inter')
    }
  )

  it('logs user_action reply for the task with a request id', async () => {
    const user = open()
    await user.click(composer())
    await user.keyboard('Thanks')
    await user.click(sendButton())
    expect(logSpy.event).toHaveBeenCalledWith(
      'user_action',
      expect.objectContaining({
        feature: 'web-threads',
        action: 'reply',
        target: 't1',
        request_id: expect.any(String),
      })
    )
  })

  it('clears the box and shows the message at once with one tick, before the snapshot has it', async () => {
    const user = open()
    b3Actions.sendReply.mockImplementation(pendingWrite)
    await user.click(composer())
    await user.keyboard('Please use Redis')
    await user.click(sendButton())
    expect((composer() as HTMLTextAreaElement).value).toBe('')
    expect(occurrences('Please use Redis')).toBe(1)
    expect(isBefore(deepest('Started on the cache'), deepest('Please use Redis'))).toBe(true)
    expect(textAfter('Please use Redis')).toMatch(/\bsent\b/)
  })

  it('shows the message once however many snapshots then contain it, with advancing ticks', async () => {
    const user = open()
    await user.click(composer())
    await user.keyboard('Please use Redis')
    await user.click(sendButton())
    const id = sentWith()[1].id
    const echo = jamesMsg(id, 'Please use Redis', NOW)
    pushThread({ comments: [...history, echo] })
    expect(occurrences('Please use Redis')).toBe(1)
    pushThread({ comments: [...history, { ...echo, deliveredAt: NOW + 1 }] })
    expect(occurrences('Please use Redis')).toBe(1)
    expect(textAfter('Please use Redis')).toContain('received')
  })

  it('the same text sent twice takes two ids and shows twice, each once after the echo', async () => {
    const okCount = () => threadText().match(/\bok\b/g)?.length ?? 0
    const user = open()
    b3Actions.sendReply.mockImplementation(pendingWrite)
    await user.click(composer())
    await user.keyboard('ok')
    await user.click(sendButton())
    await user.click(composer())
    await user.keyboard('ok')
    await user.click(sendButton())
    expect(b3Actions.sendReply).toHaveBeenCalledTimes(2)
    const [first, second] = b3Actions.sendReply.mock.calls.map((call) => call[1].id)
    expect(first).not.toBe(second)
    expect(okCount()).toBe(2)
    // Only the first echo has arrived; the second write is still pending: both still show.
    pushThread({ comments: [...history, jamesMsg(first, 'ok', NOW)] })
    expect(okCount()).toBe(2)
    // The snapshot echoes both by id (the first already delivered): each shows exactly once.
    pushThread({
      comments: [
        ...history,
        jamesMsg(first, 'ok', NOW, { deliveredAt: NOW + 1 }),
        jamesMsg(second, 'ok', NOW + 2),
      ],
    })
    expect(okCount()).toBe(2)
    expect(threadText().match(/\breceived\b/g)).toHaveLength(1)
    expect(threadText().match(/\bsent\b/g)).toHaveLength(1)
  })
})

describe('B3-14 quick replies in the composer area', () => {
  installClock()

  const stillOnThread = () => {
    expect(where()).toBe('/t/t1')
    expect(queryComposer()).toBeTruthy()
  }

  it('an option chip answers the question and stays on the thread', async () => {
    const user = open(question)
    await user.click(screen.getByRole('button', { name: 'B · Atkinson' }))
    expect(actions.answerQuestion).toHaveBeenCalledTimes(1)
    expect(actions.answerQuestion).toHaveBeenCalledWith(expect.objectContaining({ id: 't1' }), {
      key: 'B',
      label: 'Atkinson',
    })
    expect(logSpy.event).toHaveBeenCalledWith(
      'user_action',
      expect.objectContaining({ feature: 'web-threads', action: 'answer', target: 't1' })
    )
    stillOnThread()
  })

  it('Approve spec approves the task and stays on the thread', async () => {
    const user = open(makeTask('t1', { title: 'Spec the search', needs: { kind: 'spec' } }))
    await user.click(screen.getByRole('button', { name: 'Approve spec' }))
    expect(actions.approveSpec).toHaveBeenCalledWith(expect.objectContaining({ id: 't1' }))
    expect(logSpy.event).toHaveBeenCalledWith(
      'user_action',
      expect.objectContaining({ action: 'approve_spec', target: 't1' })
    )
    stillOnThread()
  })

  it('a PR need offers the PR link and Merged it, which marks it merged', async () => {
    const user = open(
      makeTask('t1', {
        title: 'Ship the footer',
        stage: 'pr',
        needs: { kind: 'pr' },
        pr: { number: 42, url: 'https://github.com/x/site/pull/42' },
      })
    )
    const link = screen.getByRole('link', { name: /Open PR #42/ })
    expect(link.getAttribute('href')).toBe('https://github.com/x/site/pull/42')
    await user.click(screen.getByRole('button', { name: 'Merged it' }))
    expect(actions.markMerged).toHaveBeenCalledWith(expect.objectContaining({ id: 't1' }))
    stillOnThread()
  })

  it.each([
    ['Small change…', 'change', makeTask('t1', { title: 'Spec it', needs: { kind: 'spec' } })],
    [
      'Open the 2 steps',
      'read',
      makeTask('t1', {
        title: 'Check the deploy',
        stage: 'after_deploy',
        afterDeploy: ['Open the site', 'Sign in'],
        needs: { kind: 'after_deploy' },
      }),
    ],
  ] as const)('%s opens the decision sheet in mode %s', async (name, mode, task) => {
    const user = open(task)
    await user.click(screen.getByRole('button', { name }))
    const sheet = screen.getByRole('dialog', { name: 'Decision sheet' })
    expect(sheet.textContent).toContain(`sheet ${mode}: ${task.title}`)
    stillOnThread()
  })

  it('shows no quick replies when the task needs nothing', () => {
    open(quiet)
    for (const name of ['Approve spec', 'Small change…', 'Merged it', 'Read more'])
      expect(screen.queryByRole('button', { name })).toBeNull()
  })
})

describe('B3-14 a done task', () => {
  installClock()

  it('has no composer; the footer starts with Done', () => {
    const done = makeTask('t1', { title: 'Build the cache', stage: 'done', doneAt: NOW - DAY })
    setThread(done, {
      comments: [jamesMsg('j1', 'Nice work', NOW - DAY, { handledAt: NOW - DAY })],
    })
    renderThread('/t/t1', <Thread />)
    expect(queryComposer()).toBeNull()
    expect(screen.queryByRole('button', { name: 'Send' })).toBeNull()
    const last = deepest('Nice work')
    const footer = screen
      .getAllByText(/^\s*Done/)
      .filter((el) => isBefore(last, el) && !el.closest('ol, ul, [role="list"]'))
    expect(footer.length).toBeGreaterThan(0)
  })
})
