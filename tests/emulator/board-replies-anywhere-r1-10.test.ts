// board-replies-anywhere R1, criterion 10: the session instructions (SESSION_INSTRUCTIONS) no
// longer say James's replies arrive as channel events; they tell every session to start the
// `watcher` command from kanban_create_task / kanban_start_task as a background command
// (run_in_background), to treat each line it prints as James's own words, to start it again after
// each reply, and to record an answer given in chat with kanban_answered_in_session. kanban_ask's
// description and result note say the answer arrives through the watcher. Each rule is checked
// within one paragraph or numbered step; kanban_ask through the real agent over stdio.
import { describe, expect, it } from 'vitest'
import { SESSION_INSTRUCTIONS } from '../../packages/agent/src/instructions.ts'
import { useBoardDb, useSession } from '../fixtures/board-replies-anywhere-emulator.ts'

useBoardDb()
const session = useSession('r1-10')

// The paragraphs and numbered steps of the instructions, whitespace folded.
const chunks = SESSION_INSTRUCTIONS.split(/\n\s*\n|\n(?=\s*\d+\.\s)/)
  .map((c) => c.replace(/\s+/g, ' ').trim())
  .filter(Boolean)
const saying = (...words: RegExp[]) => chunks.filter((c) => words.every((w) => w.test(c)))

describe('R1-10 the instructions and kanban_ask point at the watcher', () => {
  it('no longer say replies arrive as channel events', () => {
    expect(SESSION_INSTRUCTIONS).not.toContain('from="james"')
    expect(SESSION_INSTRUCTIONS).not.toContain('kind="answer"')
    expect(SESSION_INSTRUCTIONS).not.toMatch(
      /(answer|approval|repl(y|ies)|comments?) (arrives?|comes?) (as|through|via|on) (a |the )?(<channel|channel)/i
    )
  })

  it('start the watcher from the task result as a background command', () => {
    expect(saying(/watcher/i, /run_in_background/, /kanban_(start|create)_task/)).not.toHaveLength(
      0
    )
  })

  it('treat what the watcher prints as James’s own words', () => {
    expect(saying(/watcher|prints/i, /James/, /own words|typed/i)).not.toHaveLength(0)
  })

  it('start the watcher again after handling each reply', () => {
    expect(
      saying(/watcher/i, /again|restart/i, /(each|every) (reply|line)|after/i)
    ).not.toHaveLength(0)
  })

  it('record an answer James gave in chat with kanban_answered_in_session', () => {
    expect(
      saying(/kanban_answered_in_session/, /chat|in the session/i, /question|answer/i)
    ).not.toHaveLength(0)
  })

  it('kanban_ask: description and result note say the answer comes through the watcher', async () => {
    const s = session()
    const ask = (await s.tools()).find((t) => t.name === 'kanban_ask')
    expect(ask?.description).toMatch(/watcher/i)
    expect(ask?.description).not.toContain('<channel')
    const { id } = await s.json<{ id: string }>('kanban_create_task', {
      title: 'R1-10',
      type: 'chore',
    })
    const r = await s.json<{ note: string }>('kanban_ask', {
      task_id: id,
      question: 'Which branch?',
    })
    expect(r.note).toMatch(/watcher/i)
    expect(r.note).not.toContain('<channel')
  })
})
