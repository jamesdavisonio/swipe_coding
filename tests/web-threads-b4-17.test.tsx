// @vitest-environment jsdom
// web-threads B4, criterion 17: the question sheet. Read more shows the full question, one
// button per option and a free-text field; choosing an option or sending text calls
// answerQuestion once (option: its key and label; free text: the label only) and closes when it
// resolves. A failed write keeps the sheet open with an inline error and the typed text. What the
// answer stores is tested in the emulator (tests/emulator/web-threads-b4-17.test.ts).
import { describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import DecisionSheet from '../packages/web/src/components/DecisionSheet.tsx'
import { installClock } from './fixtures/web-threads-b2.tsx'
import { deniedWrite, pendingWrite } from './fixtures/web-threads-b3.tsx'
import {
  SAVE_ERROR,
  actions,
  failures,
  inDialog,
  questionTask,
  renderSheet,
  tapRequestId,
  userActions,
  writeCount,
} from './fixtures/web-threads-b4.tsx'

vi.mock('../packages/web/src/data.ts', async () =>
  (await import('./fixtures/web-threads-b4.tsx')).dataModule()
)
vi.mock('../packages/web/src/lib/log.ts', async () =>
  (await import('./fixtures/web-threads-b2.tsx')).logModule()
)
vi.mock('../packages/web/src/firebase.ts', () => ({ app: {}, auth: {}, db: {} }))

const QUESTION = 'Which font should we use?'
const TYPED = 'Use the system font'
const open = (t = questionTask()) => renderSheet(DecisionSheet, t, 'read')

const option = (name: string) => inDialog().getByRole<HTMLButtonElement>('button', { name })
const answerBox = () =>
  inDialog().getByRole<HTMLTextAreaElement>('textbox', { name: 'Or answer in your words' })
const sendAnswer = () => inDialog().getByRole<HTMLButtonElement>('button', { name: 'Send answer' })

describe('B4-17 the question sheet shows the question', () => {
  installClock()

  it('is a dialog named by the full question', () => {
    open()
    expect(screen.getByRole('dialog', { name: QUESTION })).toBeTruthy()
  })

  it('is named by the whole of a long question, not a shortened one', () => {
    const long =
      'Should the search box match only task titles, or also the descriptions, the spec goals ' +
      'and the session summaries, and should it ignore accents and letter case so that typing ' +
      'on a phone finds the same tasks as typing on the desktop does?'
    expect(long.length).toBeGreaterThanOrEqual(200)
    open(questionTask({ needs: { kind: 'question', question: long, options: [] } }))
    expect(screen.getByRole('dialog', { name: long })).toBeTruthy()
  })

  it('is named Question when the need has no question text', () => {
    open(questionTask({ needs: { kind: 'question', options: [{ key: 'A', label: 'Inter' }] } }))
    expect(screen.getByRole('dialog', { name: 'Question' })).toBeTruthy()
  })

  it('offers one button per option and a free-text answer', () => {
    open()
    expect(option('A · Inter')).toBeTruthy()
    expect(option('B · Atkinson')).toBeTruthy()
    expect(answerBox().value).toBe('')
    expect(sendAnswer().disabled).toBe(true)
  })

  it('keeps Send answer disabled for whitespace-only text', async () => {
    const { user } = open()
    await user.click(answerBox())
    await user.keyboard('   ')
    expect(sendAnswer().disabled).toBe(true)
    await user.keyboard(TYPED)
    expect(sendAnswer().disabled).toBe(false)
  })
})

describe('B4-17 answering', () => {
  installClock()

  it('an option calls answerQuestion once with its key and label and closes', async () => {
    const { onClose, user } = open()
    await user.click(option('B · Atkinson'))
    expect(actions.answerQuestion).toHaveBeenCalledTimes(1)
    const [sentTask, answer] = actions.answerQuestion.mock.calls[0]
    expect(sentTask).toEqual(expect.objectContaining({ id: 't1' }))
    expect(answer).toEqual({ key: 'B', label: 'Atkinson' })
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
    expect(writeCount()).toBe(1)
  })

  it('typed text calls answerQuestion once with the label only and closes', async () => {
    const { onClose, user } = open()
    await user.click(answerBox())
    await user.keyboard(TYPED)
    await user.click(sendAnswer())
    expect(actions.answerQuestion).toHaveBeenCalledTimes(1)
    const answer = actions.answerQuestion.mock.calls[0][1] as { key?: string; label: string }
    expect(answer.key).toBeUndefined()
    expect(answer.label.trim()).toBe(TYPED)
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
  })

  it('logs user_action answer with the task id', async () => {
    const { user } = open()
    await user.click(option('A · Inter'))
    expect(userActions('answer')).toHaveLength(1)
    expect(userActions('answer')[0][1]).toEqual(
      expect.objectContaining({ feature: 'web-threads', action: 'answer', target: 't1' })
    )
  })

  it('disables the answers while the write is pending, so one tap writes once', async () => {
    const { onClose, user } = open()
    actions.answerQuestion.mockImplementation(pendingWrite)
    await user.click(option('A · Inter'))
    expect(option('A · Inter').disabled).toBe(true)
    await user.click(option('A · Inter'))
    await user.click(option('B · Atkinson'))
    expect(actions.answerQuestion).toHaveBeenCalledTimes(1)
    expect(onClose).not.toHaveBeenCalled()
  })

  it('disables Send answer while typed text is being saved, so a double tap writes once', async () => {
    const { onClose, user } = open()
    actions.answerQuestion.mockImplementation(pendingWrite)
    await user.click(answerBox())
    await user.keyboard(TYPED)
    await user.click(sendAnswer())
    await user.click(sendAnswer())
    expect(sendAnswer().disabled).toBe(true)
    expect(actions.answerQuestion).toHaveBeenCalledTimes(1)
    expect(onClose).not.toHaveBeenCalled()
  })

  it('keeps the typed text and shows an inline error when the write fails', async () => {
    const { onClose, user } = open()
    actions.answerQuestion.mockImplementation(deniedWrite)
    await user.click(answerBox())
    await user.keyboard(TYPED)
    await user.click(sendAnswer())
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toMatch(SAVE_ERROR)
    expect(answerBox().value).toBe(TYPED)
    expect(onClose).not.toHaveBeenCalled()
    const failed = failures('answer')
    expect(failed).toHaveLength(1)
    expect(failed[0][2]).toEqual(
      expect.objectContaining({ target: 'firestore', status: 'permission-denied' })
    )
    expect((failed[0][2] as { request_id?: unknown }).request_id).toBe(tapRequestId('answer'))
  })
})
