// swipe-deck 47: a spec card is revised when the spec version is above 1; the overview counts
// the cards by kind and by project.
import { describe, expect, it } from 'vitest'
import { KIND_ORDER, buildDeck, deckOverview } from '../packages/web/src/lib/deck.ts'
import { NOW, makeTask } from './fixtures/web-threads-b2.tsx'

const spec = (version: number | null) =>
  version === null ? null : { goal: 'g', points: [], out: '', touches: '', version }
const build = (tasks: ReturnType<typeof makeTask>[]) =>
  buildDeck({ tasks, projects: [], specBodies: {}, handledNext: [], passed: [], now: NOW })

describe('swipe-deck 47: revised', () => {
  it.each([
    [3, true],
    [2, true],
    [1, false],
    [null, false],
  ])('spec version %s gives revised=%s', (version, revised) => {
    const [card] = build([makeTask('s', { needs: { kind: 'spec' }, spec: spec(version) })])
    expect(card.revised).toBe(revised)
  })

  it('only spec cards are revised', () => {
    const [card] = build([makeTask('q', { needs: { kind: 'question', question: 'Which?' } })])
    expect(card.revised).toBe(false)
  })
})

describe('swipe-deck 47: overview', () => {
  it('counts by kind (in KIND_ORDER) and by project', () => {
    const cards = build([
      makeTask('s1', { needs: { kind: 'spec' } }),
      makeTask('s2', { projectId: 'p-site', needs: { kind: 'spec' } }),
      makeTask('q', { projectId: 'p-site', needs: { kind: 'question', question: 'Which?' } }),
    ])
    const overview = deckOverview(cards)
    expect(overview.total).toBe(3)
    expect(overview.byKind).toEqual([
      { kind: 'spec', count: 2 },
      { kind: 'question', count: 1 },
    ])
    const positions = overview.byKind.map((k) => KIND_ORDER.indexOf(k.kind))
    expect(positions).toEqual([...positions].sort((a, b) => a - b))
    const byProject = [...overview.byProject].sort((a, b) => a.projectId.localeCompare(b.projectId))
    expect(byProject.map((p) => [p.projectId, p.projectName, p.count])).toEqual([
      ['p-kanban', 'p-kanban', 1],
      ['p-site', 'p-site', 2],
    ])
    expect([...byProject[1].kinds].sort()).toEqual(['question', 'spec'])
  })

  it('is empty for no cards', () => {
    expect(deckOverview([])).toEqual({ total: 0, byKind: [], byProject: [] })
  })
})
