// @vitest-environment jsdom
// board-briefs B7, criterion 33: a task waiting on a question whose text is a brief (fix, round
// and summary briefs are posted with kanban_ask) reads `<label> — <task title>` on its row and as
// its sheet title, never raw markdown. When the brief ends with `Reply "<phrase>", or tell me what
// to change.`, the row offers a one-tap `<phrase>` button before Read more and the sheet offers it
// beside the free-text answer; tapping it calls answerQuestion(task, { label: <phrase> }) once and
// logs user_action gate_reply for the task.
import { describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Task } from '../packages/shared/src/index.ts'
import DecisionSheet from '../packages/web/src/components/DecisionSheet.tsx'
import Threads from '../packages/web/src/pages/Threads.tsx'
import {
  installClock,
  makeTask,
  openButton,
  renderAt,
  rowOf,
  rowText,
} from './fixtures/web-threads-b2.tsx'
import { deniedWrite } from './fixtures/web-threads-b3.tsx'
import {
  SAVE_ERROR,
  actions,
  failures,
  inDialog,
  renderSheet,
  tapRequestId,
  userActions,
} from './fixtures/web-threads-b4.tsx'
import { setB6 } from './fixtures/web-threads-b6.tsx'
import {
  LABEL,
  PARTS,
  PHRASE,
  briefMessage,
  expectCard,
  replyLine,
  type Gate,
} from './fixtures/board-briefs-b7.tsx'

vi.mock('../packages/web/src/data.ts', async () =>
  (await import('./fixtures/web-threads-b6.tsx')).dataModule()
)
vi.mock('../packages/web/src/lib/log.ts', async () =>
  (await import('./fixtures/web-threads-b2.tsx')).logModule()
)
vi.mock('../packages/web/src/firebase.ts', () => ({ app: {}, auth: {}, db: {} }))

const TITLE = 'Export the report'

// A task waiting on a question whose text is a `gate` brief, with or without the Reply line.
const asking = (gate: Gate, reply = true) =>
  makeTask('t1', {
    title: TITLE,
    type: 'bugfix',
    stage: 'fix',
    summary: '',
    needs: {
      kind: 'question',
      question: briefMessage(gate, {
        before: 'Before I change the export:',
        after: reply ? replyLine(gate) : undefined,
      }),
    },
  })

const showRow = (task: Task) => {
  setB6(task)
  renderAt('/', <Threads />)
  return userEvent.setup()
}
// The row's buttons other than its open control, by name, in order.
const rowReplies = () => {
  const open = openButton(TITLE)
  return within(rowOf(open))
    .getAllByRole('button')
    .filter((b) => b !== open)
    .map((b) => b.textContent?.trim() ?? '')
}

describe('B7-33 a question brief on its Threads row', () => {
  installClock()

  it.each([
    ['fix', 'Fix — Export the report'],
    ['round', 'Another round — Export the report'],
    ['summary', 'Summary — Export the report'],
  ])('a %s brief reads "%s", never the raw markdown', (gate, line) => {
    showRow(asking(gate as Gate))
    const text = rowText(openButton(TITLE))
    expect(text).toContain(line)
    expect(text).not.toContain('## Decision brief')
    expect(text).not.toContain('###')
  })

  it('offers the phrase as a one-tap button, then Read more', () => {
    showRow(asking('fix'))
    expect(rowReplies()).toEqual([PHRASE.fix, 'Read more'])
  })

  it('offers only Read more when the brief has no Reply line', () => {
    showRow(asking('round', false))
    expect(rowText(openButton(TITLE))).toContain(`${LABEL.round} — ${TITLE}`)
    expect(rowReplies()).toEqual(['Read more'])
  })

  it('tapping the phrase answers with exactly that phrase, once, and logs gate_reply', async () => {
    const user = showRow(asking('fix'))
    await user.click(screen.getByRole('button', { name: PHRASE.fix }))
    expect(actions.answerQuestion).toHaveBeenCalledTimes(1)
    const [task, answer] = actions.answerQuestion.mock.calls[0]
    expect(task).toEqual(expect.objectContaining({ id: 't1' }))
    expect(answer).toEqual({ label: PHRASE.fix })
    expect(userActions('gate_reply')).toHaveLength(1)
    expect(userActions('gate_reply')[0][1]).toEqual(
      expect.objectContaining({ action: 'gate_reply', target: 't1' })
    )
  })

  it('a rejected phrase answer is logged as api_call_failed under the tap request id', async () => {
    const user = showRow(asking('fix'))
    actions.answerQuestion.mockImplementationOnce(deniedWrite)
    await user.click(screen.getByRole('button', { name: PHRASE.fix }))
    await waitFor(() => expect(failures('gate_reply')).toHaveLength(1))
    expect(failures('gate_reply')[0][2]).toEqual(
      expect.objectContaining({ target: 'firestore', status: 'permission-denied' })
    )
    expect((failures('gate_reply')[0][2] as { request_id?: unknown }).request_id).toBe(
      tapRequestId('gate_reply')
    )
  })
})

describe('B7-33 a question brief in the decision sheet', () => {
  installClock()

  it.each([
    ['fix', 'Fix — Export the report'],
    ['summary', 'Summary — Export the report'],
  ])('a %s brief: the sheet is titled "%s" and shows the brief card', (gate, title) => {
    renderSheet(DecisionSheet, asking(gate as Gate))
    expect(screen.getByRole('dialog', { name: title })).toBeTruthy()
    expect(inDialog().getByRole('heading', { name: LABEL[gate as Gate] })).toBeTruthy()
    expectCard(screen.getByRole('dialog'), PARTS[gate as Gate])
  })

  it('offers the phrase beside the free-text answer', () => {
    renderSheet(DecisionSheet, asking('summary'))
    expect(inDialog().getByRole('button', { name: PHRASE.summary })).toBeTruthy()
    expect(inDialog().getByRole('textbox', { name: 'Or answer in your words' })).toBeTruthy()
    expect(inDialog().getByRole('button', { name: 'Send answer' })).toBeTruthy()
  })

  it('tapping the phrase answers with exactly that phrase, once, and logs gate_reply', async () => {
    const { user } = renderSheet(DecisionSheet, asking('round'))
    await user.click(inDialog().getByRole('button', { name: PHRASE.round }))
    expect(actions.answerQuestion).toHaveBeenCalledTimes(1)
    const [task, answer] = actions.answerQuestion.mock.calls[0]
    expect(task).toEqual(expect.objectContaining({ id: 't1' }))
    expect(answer).toEqual({ label: PHRASE.round })
    expect(userActions('gate_reply')).toHaveLength(1)
    expect(userActions('gate_reply')[0][1]).toEqual(
      expect.objectContaining({ action: 'gate_reply', target: 't1' })
    )
  })

  it('has no phrase button when the brief has no Reply line', () => {
    renderSheet(DecisionSheet, asking('fix', false))
    expect(screen.getByRole('dialog', { name: `${LABEL.fix} — ${TITLE}` })).toBeTruthy()
    expect(inDialog().queryByRole('button', { name: PHRASE.fix })).toBeNull()
    expect(inDialog().getByRole('button', { name: 'Send answer' })).toBeTruthy()
  })

  it('a rejected phrase answer keeps the sheet open with the save error and logs it', async () => {
    const { onClose, user } = renderSheet(DecisionSheet, asking('fix'))
    actions.answerQuestion.mockImplementationOnce(deniedWrite)
    await user.click(inDialog().getByRole('button', { name: PHRASE.fix }))
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toMatch(SAVE_ERROR)
    expect(screen.getByRole('dialog', { name: `${LABEL.fix} — ${TITLE}` })).toBeTruthy()
    expect(onClose).not.toHaveBeenCalled()
    const failed = failures('gate_reply')
    expect(failed).toHaveLength(1)
    expect(failed[0][2]).toEqual(
      expect.objectContaining({ target: 'firestore', status: 'permission-denied' })
    )
    expect((failed[0][2] as { request_id?: unknown }).request_id).toBe(tapRequestId('gate_reply'))
  })
})
