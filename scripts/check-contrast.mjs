#!/usr/bin/env node
/* scripts/check-contrast.mjs
 * Verifies that the token pairs below meet WCAG AA (or AAA with WCAG_TARGET=AAA) in both
 * themes of packages/web/src/styles/tokens.css. Runs in ci-fast-feedback.yml and before
 * any change-ui / implement-feature touching the tokens. Never delete a pair to pass —
 * adjust the tokens. A pair that genuinely may be lower (decorative) is removed with a
 * comment saying why.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const TOKENS = join(process.cwd(), 'packages/web/src/styles/tokens.css')
const TARGET = process.env.WCAG_TARGET === 'AAA' ? 'AAA' : 'AA'
const NORMAL = TARGET === 'AAA' ? 7.0 : 4.5
const LARGE = TARGET === 'AAA' ? 4.5 : 3.0
const UI = 3.0

// kind: normal = body text, large = ≥18.5px bold / 24px, ui = borders, rings, icons.
const PAIRS = [
  { fg: '--foreground', bg: '--background', kind: 'normal', where: 'text on page' },
  { fg: '--foreground', bg: '--card', kind: 'normal', where: 'text on card' },
  { fg: '--muted-foreground', bg: '--background', kind: 'normal', where: 'secondary text on page' },
  { fg: '--muted-foreground', bg: '--card', kind: 'normal', where: 'secondary text on card' },
  { fg: '--muted-foreground', bg: '--muted', kind: 'normal', where: 'quiet badge' },
  { fg: '--primary', bg: '--background', kind: 'normal', where: 'links on page' },
  { fg: '--primary', bg: '--card', kind: 'normal', where: 'links on card' },
  { fg: '--primary-foreground', bg: '--primary', kind: 'normal', where: 'accent button' },
  { fg: '--primary', bg: '--primary-soft', kind: 'normal', where: 'me badge' },
  { fg: '--needs', bg: '--needs-soft', kind: 'normal', where: 'needs badge' },
  { fg: '--needs-foreground', bg: '--needs', kind: 'normal', where: 'needs counter' },
  { fg: '--needs', bg: '--card', kind: 'normal', where: 'chip count and unread time on card' },
  { fg: '--needs', bg: '--background', kind: 'normal', where: 'needs text on page' },
  { fg: '--background', bg: '--foreground', kind: 'normal', where: 'pressed chip' },
  { fg: '--ok', bg: '--ok-soft', kind: 'normal', where: 'ok badge' },
  { fg: '--ok-foreground', bg: '--ok', kind: 'normal', where: 'ok button' },
  { fg: '--me-foreground', bg: '--me', kind: 'normal', where: 'primary button / my message' },
  { fg: '--ring', bg: '--background', kind: 'ui', where: 'focus ring on page' },
  { fg: '--ring', bg: '--card', kind: 'ui', where: 'focus ring on card' },
  // Swipe deck: every card tone carries its own text, the stamps sit on a card-coloured label,
  // and the hold button's countdown (22px bold) sits on the important fill as it grows.
  ...['decision', 'round', 'important', 'alert', 'todo', 'summary', 'next'].map((tone) => ({
    fg: `--tone-${tone}-foreground`,
    bg: `--tone-${tone}`,
    kind: 'normal',
    where: `deck ${tone} card text`,
  })),
  { fg: '--ok', bg: '--card', kind: 'normal', where: 'deck yes stamp' },
  { fg: '--stamp-important', bg: '--card', kind: 'normal', where: 'deck yes stamp (important)' },
  { fg: '--rec', bg: '--card', kind: 'normal', where: 'deck recording timer' },
  { fg: '--foreground', bg: '--tone-important', kind: 'large', where: 'deck hold countdown' },
]

const src = readFileSync(TOKENS, 'utf8')

function hslFromToken(scope, name) {
  const re = new RegExp(
    `${scope.replace('.', '\\.')}\\s*\\{[^}]*${name}\\s*:\\s*([\\d.]+)\\s+([\\d.]+)%\\s+([\\d.]+)%`,
    's'
  )
  const m = src.match(re)
  if (!m) throw new Error(`token ${name} not found in scope ${scope}`)
  return { h: +m[1], s: +m[2], l: +m[3] }
}

function relLuminance({ h, s, l }) {
  s /= 100
  l /= 100
  const k = (n) => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  const [r, g, b] = [f(0), f(8), f(4)]
  const lin = (c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4))
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

function ratio(a, b) {
  const [x, y] = [a, b].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}

const findings = []
const rows = []
for (const scope of [':root', '.dark']) {
  for (const p of PAIRS) {
    const r = ratio(
      relLuminance(hslFromToken(scope, p.fg)),
      relLuminance(hslFromToken(scope, p.bg))
    )
    const threshold = p.kind === 'ui' ? UI : p.kind === 'large' ? LARGE : NORMAL
    rows.push(
      `  ${scope.padEnd(6)} ${p.where.padEnd(28)} ${r.toFixed(2).padStart(6)}  (≥ ${threshold})`
    )
    if (r < threshold) findings.push({ scope, ...p, ratio: r.toFixed(2), threshold })
  }
}

if (process.argv.includes('--verbose')) console.log(rows.join('\n'))

if (findings.length) {
  console.error(
    `✖ contrast check failed (${findings.length} pair${findings.length === 1 ? '' : 's'} below WCAG ${TARGET}):`
  )
  for (const f of findings) {
    console.error(
      `  [${f.scope}] ${f.where}: ${f.fg} vs ${f.bg} = ${f.ratio} (need ≥ ${f.threshold})`
    )
  }
  process.exit(1)
}

console.log(`✓ contrast passes WCAG ${TARGET} for ${PAIRS.length * 2} pairs (:root + .dark).`)
