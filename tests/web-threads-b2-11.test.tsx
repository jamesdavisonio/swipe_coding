// @vitest-environment jsdom
// web-threads B2, criterion 11: tapping a row's title opens the thread and clears unread;
// tapping a quick reply dispatches its action (or opens the decision sheet) and stays on Threads.
import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Threads from '../packages/web/src/pages/Threads.tsx'
import {
  actions,
  installClock,
  logSpy,
  makeTask,
  openButton,
  renderAt,
  setBoard,
  where,
} from './fixtures/web-threads-b2.tsx'

vi.mock('../packages/web/src/data.ts', async () =>
  (await import('./fixtures/web-threads-b2.tsx')).dataModule()
)
vi.mock('../packages/web/src/lib/log.ts', async () =>
  (await import('./fixtures/web-threads-b2.tsx')).logModule()
)
vi.mock('../packages/web/src/components/DecisionSheet.tsx', async () =>
  (await import('./fixtures/web-threads-b2.tsx')).sheetModule()
)
vi.mock('../packages/web/src/firebase.ts', () => ({ app: {}, auth: {}, db: {} }))

const spec = makeTask('t-spec', { title: 'Spec the search', needs: { kind: 'spec' } })
const question = makeTask('t-question', {
  projectId: 'p-site',
  title: 'Pick a font',
  stage: 'build',
  unread: true,
  needs: {
    kind: 'question',
    question: 'Which font?',
    options: [
      { key: 'A', label: 'Inter' },
      { key: 'B', label: 'Atkinson' },
    ],
  },
})
const pr = makeTask('t-pr', {
  projectId: 'p-site',
  title: 'Ship the footer',
  stage: 'pr',
  needs: { kind: 'pr' },
  pr: { number: 42, url: 'https://github.com/x/site/pull/42' },
})
const steps = makeTask('t-steps', {
  title: 'Check the deploy',
  stage: 'after_deploy',
  afterDeploy: ['Open the site', 'Sign in'],
  needs: { kind: 'after_deploy' },
})
const quiet = makeTask('t-quiet', { title: 'Build the cache', stage: 'build' })

const start = () => {
  setBoard({ tasks: [spec, question, pr, steps, quiet] })
  renderAt('/', <Threads />)
  return userEvent.setup()
}
const loggedAction = (action: string, target: string) =>
  expect(logSpy.event).toHaveBeenCalledWith(
    'user_action',
    expect.objectContaining({ feature: 'web-threads', action, target })
  )
const stillOnThreads = () => {
  expect(where()).toBe('/')
  expect(screen.getByRole('heading', { name: /^Threads/ })).toBeTruthy()
}

describe('B2-11 opening a thread', () => {
  installClock()

  it('tapping an unread row opens /t/:id, clears unread and logs open_thread', async () => {
    const user = start()
    await user.click(openButton('Pick a font'))
    expect(where()).toBe('/t/t-question')
    expect(actions.markRead).toHaveBeenCalledTimes(1)
    expect(actions.markRead).toHaveBeenCalledWith(expect.objectContaining({ id: 't-question' }))
    loggedAction('open_thread', 't-question')
  })

  it('tapping a read row opens the thread without marking it read', async () => {
    const user = start()
    await user.click(openButton('Build the cache'))
    expect(where()).toBe('/t/t-quiet')
    expect(actions.markRead).not.toHaveBeenCalled()
  })
})

describe('B2-11 quick replies act without leaving Threads', () => {
  installClock()

  it('Approve spec approves that task and logs approve_spec', async () => {
    const user = start()
    await user.click(screen.getByRole('button', { name: 'Approve spec' }))
    expect(actions.approveSpec).toHaveBeenCalledTimes(1)
    expect(actions.approveSpec).toHaveBeenCalledWith(expect.objectContaining({ id: 't-spec' }))
    loggedAction('approve_spec', 't-spec')
    stillOnThreads()
  })

  it('an option chip answers the question with that option and logs answer', async () => {
    const user = start()
    await user.click(screen.getByRole('button', { name: 'B · Atkinson' }))
    expect(actions.answerQuestion).toHaveBeenCalledTimes(1)
    expect(actions.answerQuestion).toHaveBeenCalledWith(
      expect.objectContaining({ id: 't-question' }),
      { key: 'B', label: 'Atkinson' }
    )
    loggedAction('answer', 't-question')
    expect(actions.markRead).not.toHaveBeenCalled()
    stillOnThreads()
  })

  it('Merged it marks the PR merged and logs merged', async () => {
    const user = start()
    await user.click(screen.getByRole('button', { name: 'Merged it' }))
    expect(actions.markMerged).toHaveBeenCalledTimes(1)
    expect(actions.markMerged).toHaveBeenCalledWith(expect.objectContaining({ id: 't-pr' }))
    loggedAction('merged', 't-pr')
    stillOnThreads()
  })

  it.each([
    ['Read more', 'read', pr],
    ['Small change…', 'change', spec],
    ['Open the 2 steps', 'read', steps],
  ] as const)('%s opens the decision sheet in mode %s for its task', async (name, mode, task) => {
    setBoard({ tasks: [task, quiet] })
    renderAt('/', <Threads />)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name }))
    const sheet = screen.getByRole('dialog', { name: 'Decision sheet' })
    expect(sheet.textContent).toContain(`sheet ${mode}: ${task.title}`)
    stillOnThreads()
    await user.click(screen.getByRole('button', { name: 'Close sheet' }))
    expect(screen.queryByRole('dialog', { name: 'Decision sheet' })).toBeNull()
  })
})
