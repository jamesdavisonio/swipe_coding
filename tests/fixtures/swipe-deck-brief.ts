// Builds the decision-brief text sessions post, for the swipe-deck suites: the six sub-headings in
// the format's order, an optional `Yes:` line under the heading, an optional example sentence in
// "What will change", and an optional closing Reply line. Plain text, no mocks.
export interface BriefOptions {
  yes?: string
  yesAfterBlank?: boolean
  changes?: string
  reply?: string
}

export function briefText(
  gate: 'spec' | 'fix' | 'round' | 'summary',
  o: BriefOptions = {}
): string {
  const yes = o.yes === undefined ? [] : [...(o.yesAfterBlank ? [''] : []), `Yes: ${o.yes}`]
  return [
    `## Decision brief (${gate})`,
    ...yes,
    '',
    '### Where it came from',
    'You asked for it.',
    '',
    '### Why it exists',
    'It saves time.',
    '',
    '### What will change',
    o.changes ?? 'Something visible changes.',
    '',
    '### Key assumptions',
    'None.',
    '',
    '### Out of scope',
    'Nothing else.',
    '',
    "### What you're agreeing to",
    'A small build.',
    ...(o.reply === undefined ? [] : ['', `Reply "${o.reply}", or tell me what to change.`]),
  ].join('\n')
}
