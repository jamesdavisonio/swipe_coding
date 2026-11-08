// decision-notifications 80 (pure part): a notice's tag is "decision:<task id>" whatever the
// need or revision, so a revised spec or a new question replaces the earlier notification on the
// phone, while another task's notice has its own tag.
import { describe, expect, it } from 'vitest'
import { decisionNotice } from '../packages/shared/src/index.ts'
import { makeTask } from './fixtures/web-threads-b2.tsx'
import { briefText } from './fixtures/swipe-deck-brief.ts'

describe('decision-notifications 80: one tag per task', () => {
  it('is the same for a spec, a revised spec and a later question on one task', () => {
    const spec = makeTask('t1', { stage: 'spec', needs: { kind: 'spec' } })
    const asked = makeTask('t1', {
      stage: 'build',
      needs: { kind: 'question', question: briefText('round', { yes: 'Another go' }) },
    })
    const tags = [
      decisionNotice(spec, 'kanban', briefText('spec', { yes: 'First draft' }))?.tag,
      decisionNotice(spec, 'kanban', briefText('spec', { yes: 'Second draft' }))?.tag,
      decisionNotice(asked, 'kanban')?.tag,
    ]
    expect(tags).toEqual(['decision:t1', 'decision:t1', 'decision:t1'])
  })

  it('differs between tasks', () => {
    const a = decisionNotice(makeTask('t1', { needs: { kind: 'spec' } }), 'kanban')
    const b = decisionNotice(makeTask('t2', { needs: { kind: 'spec' } }), 'kanban')
    expect(a?.tag).not.toBe(b?.tag)
  })
})
