// Shared fixture for the board-briefs B7 suites (decision briefs, PR-ready, finished-work
// summaries). Builds on the web-threads B2-B6 fixtures (task and comment builders, the mocked
// data.ts with every hook and write, the logger spy, the routers); B7 adds no data.ts names, so the
// suites mock data.ts with the B6 fixture's dataModule. This module adds the brief text sessions
// post (the skills' decision-brief format), what the board should read out of it, a clipboard spy
// and a few readers. It is loaded next to the data.ts mock, so it must not import the app.
import { expect, vi, type Mock } from 'vitest'
import type { UserEvent } from '@testing-library/user-event'
import { logSpy } from './web-threads-b2.tsx'
import { textIn } from './web-threads-b5.tsx'

// ---- the pure helpers under test -------------------------------------------------------------

// packages/web/src/lib/brief.ts (parseBrief, suggestedNext), loaded when a test runs, so a suite
// that also renders screens reports each test on its own instead of failing to load as a whole.
export type BriefModule = typeof import('../../packages/web/src/lib/brief.ts')
const BRIEF_MODULE = '../../packages/web/src/lib/brief.ts'
export const loadBrief = () => import(/* @vite-ignore */ BRIEF_MODULE) as Promise<BriefModule>

// ---- the brief format ----------------------------------------------------------------------

export type Gate = 'spec' | 'fix' | 'round' | 'summary'
export const GATES: readonly Gate[] = ['spec', 'fix', 'round', 'summary']

export const SUBHEADINGS = [
  'Where it came from',
  'Why it exists',
  'What will change',
  'Key assumptions',
  'Out of scope',
  "What you're agreeing to",
] as const
export const PART_KEYS = ['origin', 'why', 'changes', 'assumptions', 'out', 'agreeing'] as const
export type PartKey = (typeof PART_KEYS)[number]
export type Parts = Record<PartKey, string>

export const LABEL: Record<Gate, string> = {
  spec: 'Spec',
  fix: 'Fix',
  round: 'Another round',
  summary: 'Summary',
}
export const PHRASE: Record<Gate, string> = {
  spec: 'spec confirmed',
  fix: 'fix confirmed',
  round: 'another round',
  summary: 'ship it',
}

// One brief per gate, from the skills' examples; every part's text is unique across all four.
export const PARTS: Record<Gate, Parts> = {
  spec: {
    origin: 'Claude suggested this on 3 November while working on board comments.',
    why: 'Replies sent close together can show newest first.',
    changes: 'Replies always appear in the order they were sent.',
    assumptions: 'The time a reply was sent is the right order.',
    out: 'Editing or deleting a reply.',
    agreeing: 'Nothing unusual. Yes starts the build.',
  },
  fix: {
    origin: 'You asked for this on 4 November after the nightly export came back empty.',
    why: 'The export skips every row when one row has a blank date.',
    changes: 'Rows with a blank date export with the date left empty.',
    assumptions: 'An empty date is acceptable to the people who open the file.',
    out: 'Finding out why some rows have no date.',
    agreeing: 'This touches how data is written to the shared drive.',
  },
  round: {
    origin: 'You confirmed the spec for ordered replies this morning.',
    why: 'One problem keeps coming back in the tests.',
    changes: 'The spec gains one sentence and the tests are repaired once more.',
    assumptions: 'The rest of the tests are sound.',
    out: 'Any other change to the spec.',
    agreeing: 'Another round costs a few minutes.',
  },
  summary: {
    origin: 'Claude suggested this on 3 November, and you confirmed the spec this morning.',
    why: 'Replies sent close together could show up in the wrong order.',
    changes: 'Replies now always show in the order they were sent.',
    assumptions: 'Two replies sent in the same second keep the order they arrived in.',
    out: 'Editing and deleting replies, as agreed.',
    agreeing: 'Yes pushes the branch and opens a pull request.',
  },
}

// The `## Decision brief (<gate>)` block alone: the six sub-headings (or `headings`, to break
// the shape) each followed by its part on the next line, parts separated by a blank line.
export function briefBlock(
  gate: string,
  opts: { parts?: Parts; headings?: readonly string[] } = {}
): string {
  const parts = opts.parts ?? PARTS[gate as Gate] ?? PARTS.spec
  const headings = opts.headings ?? SUBHEADINGS
  const body = headings
    .map((heading) => {
      const at = SUBHEADINGS.indexOf(heading as (typeof SUBHEADINGS)[number])
      const text = at >= 0 ? parts[PART_KEYS[at]] : 'Some text.'
      return `### ${heading}\n${text}`
    })
    .join('\n\n')
  return `## Decision brief (${gate})\n\n${body}`
}

// The gate's closing line.
export const replyLine = (gate: Gate, phrase = PHRASE[gate]) =>
  `Reply "${phrase}", or tell me what to change.`

// A whole message: `before`, the brief, then `after`, separated by blank lines.
export function briefMessage(
  gate: Gate,
  opts: { before?: string; after?: string; parts?: Parts } = {}
): string {
  return [opts.before, briefBlock(gate, { parts: opts.parts }), opts.after]
    .filter((part): part is string => !!part)
    .join('\n\n')
}

// Parts of a brief with every text prefixed, so two briefs of one gate can be told apart.
export const partsWith = (prefix: string, gate: Gate = 'spec'): Parts =>
  Object.fromEntries(PART_KEYS.map((key) => [key, `${prefix} ${PARTS[gate][key]}`])) as Parts

// ---- reading the screen ----------------------------------------------------------------------

// Asserts that `root` shows the brief card's six parts, each after its sub-heading and in the
// fixed order, and none of the brief's markdown markers.
export function expectCard(root: HTMLElement, parts: Parts) {
  const text = textIn(root)
  let from = 0
  SUBHEADINGS.forEach((heading, i) => {
    const h = text.indexOf(heading, from)
    expect(h, `sub-heading "${heading}" in order`).toBeGreaterThanOrEqual(0)
    const p = text.indexOf(parts[PART_KEYS[i]], h + heading.length)
    expect(p, `part "${PART_KEYS[i]}" under "${heading}"`).toBeGreaterThanOrEqual(0)
    from = p + parts[PART_KEYS[i]].length
  })
  expect(text).not.toContain('## Decision brief')
  expect(text).not.toContain('###')
}

// Index of `text` in the root's reader text (-1 when absent), for order checks.
export const posIn = (root: HTMLElement, text: string) => textIn(root).indexOf(text)

// True when `text` is on screen inside `root` and not inside something hidden from everyone (the
// `hidden` attribute, aria-hidden, an inline display:none, or a closed <details>).
export function shownIn(root: HTMLElement, text: string): boolean {
  const hits = Array.from(root.querySelectorAll<HTMLElement>('*')).filter((el) =>
    textIn(el).includes(text)
  )
  const inner = hits.filter((el) => !hits.some((other) => other !== el && el.contains(other)))
  return inner.some((el) => {
    for (let at: HTMLElement | null = el; at && at !== root.parentElement; at = at.parentElement) {
      if (at.hidden || at.getAttribute('aria-hidden') === 'true') return false
      if (at.style.display === 'none') return false
      const closed = at instanceof HTMLDetailsElement && !at.open
      if (closed && !el.closest('summary')) return false
    }
    return true
  })
}

// ---- clipboard, logging, keyboard ------------------------------------------------------------

// Replaces navigator.clipboard with a spy (jsdom has none; user-event installs its own stub on
// setup, so call this after userEvent.setup()).
export function stubClipboard(): Mock<(text: string) => Promise<void>> {
  const writeText = vi.fn((_text: string) => Promise.resolve())
  Object.defineProperty(window.navigator, 'clipboard', {
    configurable: true,
    value: { writeText },
  })
  return writeText
}

// Every user_action logged so far (any action).
export const allUserActions = () =>
  logSpy.event.mock.calls.filter((call) => call[0] === 'user_action')

// Tabs until `target` has focus (at most 80 presses) and asserts it got there.
export async function tabTo(user: UserEvent, target: HTMLElement) {
  for (let i = 0; i < 80 && document.activeElement !== target; i++) await user.tab()
  expect(document.activeElement).toBe(target)
}
