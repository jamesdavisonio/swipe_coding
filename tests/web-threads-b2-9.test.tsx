// @vitest-environment jsdom
// web-threads B2, criterion 9: a row that needs James carries the quick replies of its need
// kind (spec, question, pr, after_deploy).
import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import type { Task } from '../packages/shared/src/index.ts'
import Threads from '../packages/web/src/pages/Threads.tsx'
import { installClock, isBefore, makeTask, renderAt, setBoard } from './fixtures/web-threads-b2.tsx'

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

const QUICK = /^(Approve spec|Small change…|Read more|Merged it|Open the \d+ steps?|\w+ · .+)$/
const show = (task: Task) => {
  setBoard({ tasks: [task] })
  renderAt('/', <Threads />)
}
const button = (name: string) => screen.getByRole('button', { name })
// The quick-reply buttons on screen, in order (one row per test).
const quickReplies = () =>
  screen
    .getAllByRole('button')
    .map((b) => b.textContent?.trim() ?? '')
    .filter((t) => QUICK.test(t))
const inOrder = (els: HTMLElement[]) =>
  els.slice(1).forEach((el, i) => expect(isBefore(els[i], el)).toBe(true))

describe('B2-9 quick replies by need kind', () => {
  installClock()

  it('spec: Approve spec, Small change…, Read more', () => {
    show(makeTask('t', { title: 'Spec the search', needs: { kind: 'spec' } }))
    expect(quickReplies()).toEqual(['Approve spec', 'Small change…', 'Read more'])
  })

  it('question: one "key · label" button per option, then Read more', () => {
    show(
      makeTask('t', {
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
    )
    inOrder([button('A · Inter'), button('B · Atkinson'), button('Read more')])
    expect(quickReplies()).toEqual(['A · Inter', 'B · Atkinson', 'Read more'])
  })

  it('question without options: Read more only', () => {
    show(makeTask('t', { title: 'Pick a font', stage: 'build', needs: { kind: 'question' } }))
    expect(quickReplies()).toEqual(['Read more'])
  })

  it('pr: an external "Open PR #n" link, then Merged it and Read more', () => {
    show(
      makeTask('t', {
        title: 'Ship the footer',
        stage: 'pr',
        needs: { kind: 'pr' },
        pr: { number: 42, url: 'https://github.com/x/site/pull/42' },
      })
    )
    const link = screen.getByRole('link', { name: 'Open PR #42' })
    expect(link.getAttribute('href')).toBe('https://github.com/x/site/pull/42')
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toMatch(/noopener/)
    inOrder([link, button('Merged it'), button('Read more')])
    expect(quickReplies()).toEqual(['Merged it', 'Read more'])
  })

  it('pr without a PR recorded: no link, still Merged it and Read more', () => {
    show(makeTask('t', { title: 'Ship the footer', stage: 'pr', needs: { kind: 'pr' } }))
    expect(screen.queryByRole('link', { name: /^Open PR/ })).toBeNull()
    expect(quickReplies()).toEqual(['Merged it', 'Read more'])
  })

  it('after_deploy: "Open the N steps"', () => {
    show(
      makeTask('t', {
        title: 'Check the deploy',
        stage: 'after_deploy',
        afterDeploy: ['Open the site', 'Sign in', 'Check the footer'],
        needs: { kind: 'after_deploy' },
      })
    )
    expect(quickReplies()).toEqual(['Open the 3 steps'])
  })

  it('after_deploy with one step: "Open the 1 step"', () => {
    show(
      makeTask('t', {
        title: 'Check the deploy',
        stage: 'after_deploy',
        afterDeploy: ['Open the site'],
        needs: { kind: 'after_deploy' },
      })
    )
    expect(quickReplies()).toEqual(['Open the 1 step'])
  })

  it('quiet rows (no need) at stages pr and spec have no quick replies', () => {
    setBoard({
      tasks: [
        makeTask('q-pr', { title: 'Ship the footer', stage: 'pr', needs: null }),
        makeTask('q-spec', { title: 'Spec the search', stage: 'spec', needs: null }),
      ],
    })
    renderAt('/', <Threads />)
    expect(quickReplies()).toEqual([])
  })
})
