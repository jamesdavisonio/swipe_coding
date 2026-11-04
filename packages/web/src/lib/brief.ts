// Reading the decision briefs sessions post (the skills' decision-brief format) and the
// suggestions that end a finished summary. Pure text in, plain data out: no React, no Firestore.
// The text comes from a session, so every reader here is defensive: anything that is not exactly
// the expected shape reads as "no brief", and the caller renders the text as it is.
import type { Comment } from '@kanban/shared'

export type Gate = 'spec' | 'fix' | 'round' | 'summary'
export type PartKey = 'origin' | 'why' | 'changes' | 'assumptions' | 'out' | 'agreeing'
export type BriefParts = Record<PartKey, string>

export interface Brief {
  gate: Gate
  label: string
  parts: BriefParts
  before: string
  after: string
  replyPhrase: string | null
}

export const GATE_LABEL: Record<Gate, string> = {
  spec: 'Spec',
  fix: 'Fix',
  round: 'Another round',
  summary: 'Summary',
}

// The six sub-headings, in the order the format fixes, with the key each one is stored under.
export const BRIEF_SECTIONS: readonly { key: PartKey; heading: string }[] = [
  { key: 'origin', heading: 'Where it came from' },
  { key: 'why', heading: 'Why it exists' },
  { key: 'changes', heading: 'What will change' },
  { key: 'assumptions', heading: 'Key assumptions' },
  { key: 'out', heading: 'Out of scope' },
  { key: 'agreeing', heading: "What you're agreeing to" },
]

const BRIEF_HEADING = /^##\s+Decision brief \((spec|fix|round|summary)\)\s*$/
const SUB_HEADING = /^###\s+(.+?)\s*$/
const ANY_HEADING = /^#{1,6}\s/
const RULE = /^---+\s*$/
const REPLY_LINE = /^\s*Reply ["“]([^"”]+)["”], or tell me what to change\.\s*$/
const SUGGESTED_HEADING = /^###\s+Suggested next\s*$/i
const LIST_MARKER = /^(?:[-*]\s+|\d+\.\s+)/

const linesOf = (text: string): string[] => text.split(/\r?\n/)

// One line of prose for a part: its lines trimmed and joined with single spaces.
const prose = (lines: readonly string[]): string =>
  lines
    .map((line) => line.trim())
    .filter((line) => line !== '')
    .join(' ')

const block = (lines: readonly string[]): string => lines.join('\n').trim()

// Where a line cannot belong to the last part of a brief: a heading, a rule, the closing Reply.
const endsBrief = (line: string): boolean =>
  ANY_HEADING.test(line) || RULE.test(line.trim()) || REPLY_LINE.test(line)

// The index (in `lines`) at which the last part ends: the first blank line that is followed by a
// line that cannot continue it (see endsBrief), a heading or rule or Reply line straight away,
// or the end of the text.
function lastPartEnd(lines: readonly string[], from: number): number {
  for (let i = from; i < lines.length; i++) {
    if (endsBrief(lines[i])) return i
    if (lines[i].trim() !== '') continue
    let next = i + 1
    while (next < lines.length && lines[next].trim() === '') next++
    if (next < lines.length && endsBrief(lines[next])) return i
  }
  return lines.length
}

// The six sub-headings that follow the heading at `start`, in the format's order, as the line
// index of each; null when one is missing, different, or out of order, or a bigger heading
// interrupts them.
function subHeadingAt(lines: readonly string[], start: number): number[] | null {
  const found: number[] = []
  for (let i = start + 1; i < lines.length && found.length < BRIEF_SECTIONS.length; i++) {
    const text = lines[i].trim()
    if (/^#{1,2}\s/.test(text)) return null
    const heading = SUB_HEADING.exec(text)?.[1]
    if (heading === undefined) continue
    if (heading !== BRIEF_SECTIONS[found.length].heading) return null
    found.push(i)
  }
  return found.length === BRIEF_SECTIONS.length ? found : null
}

function readBrief(lines: readonly string[], start: number, gate: Gate): Brief | null {
  const at = subHeadingAt(lines, start)
  if (!at) return null
  const end = lastPartEnd(lines, at[at.length - 1] + 1)
  const parts = {} as BriefParts
  BRIEF_SECTIONS.forEach(({ key }, i) => {
    const until = i + 1 < at.length ? at[i + 1] : end
    parts[key] = prose(lines.slice(at[i] + 1, until))
  })
  const phrase = lines.map((line) => REPLY_LINE.exec(line)?.[1]).find((p) => p !== undefined)
  return {
    gate,
    label: GATE_LABEL[gate],
    parts,
    before: block(lines.slice(0, start)),
    after: block(lines.slice(end)),
    replyPhrase: phrase ?? null,
  }
}

// The decision brief in `text`, or null when there is none or it is not well formed: a
// `## Decision brief (<gate>)` line (spec, fix, round or summary) followed by the six `###`
// sub-headings, exactly as the format has them and in its order.
export function parseBrief(text: string): Brief | null {
  if (typeof text !== 'string') return null
  const lines = linesOf(text)
  for (let i = 0; i < lines.length; i++) {
    const gate = BRIEF_HEADING.exec(lines[i].trim())?.[1] as Gate | undefined
    if (gate === undefined) continue
    const brief = readBrief(lines, i, gate)
    if (brief) return brief
  }
  return null
}

// The text without its closing `Reply "<phrase>", or tell me what to change.` line, for places
// that offer the phrase as a button instead.
export const withoutReplyLine = (text: string): string =>
  block(linesOf(text).filter((line) => !REPLY_LINE.test(line)))

// The suggestions under a `### Suggested next` heading: one per line until the next heading or
// the end, list markers and blanks dropped.
export function suggestedNext(text: string): string[] {
  const lines = linesOf(text)
  const from = lines.findIndex((line) => SUGGESTED_HEADING.test(line.trim()))
  if (from < 0) return []
  const items: string[] = []
  for (const line of lines.slice(from + 1)) {
    if (ANY_HEADING.test(line.trim())) break
    const item = line.trim().replace(LIST_MARKER, '').trim()
    if (item !== '') items.push(item)
  }
  return items
}

// The text with its `### Suggested next` part taken out (heading and lines), for a screen that
// shows the suggestions as a list of their own.
export function withoutSuggestedNext(text: string): string {
  const lines = linesOf(text)
  const from = lines.findIndex((line) => SUGGESTED_HEADING.test(line.trim()))
  if (from < 0) return text
  const rest = lines.slice(from + 1)
  const stop = rest.findIndex((line) => ANY_HEADING.test(line.trim()))
  const tail = stop < 0 ? [] : rest.slice(stop)
  return block([...lines.slice(0, from), ...tail])
}

// The latest session message that holds a well-formed brief of `gate`, with that brief. Earlier
// briefs and plainer messages after it do not matter; James's own messages never count.
export function latestBrief(
  comments: readonly Pick<Comment, 'author' | 'body'>[],
  gate: Gate
): { brief: Brief; body: string } | null {
  for (let i = comments.length - 1; i >= 0; i--) {
    const { author, body } = comments[i]
    if (author === 'james' || typeof body !== 'string') continue
    const brief = parseBrief(body)
    if (brief?.gate === gate) return { brief, body }
  }
  return null
}

// "<label> — <task title>": what a row and a sheet call a question that is a brief.
export const briefHeadline = (brief: Pick<Brief, 'label'>, taskTitle: string): string =>
  `${brief.label} — ${taskTitle}`
