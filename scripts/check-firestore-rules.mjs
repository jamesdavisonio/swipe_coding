#!/usr/bin/env node
/* scripts/check-firestore-rules.mjs
 * Fails CI if firestore.rules contains dangerous patterns. Static grep, no emulator needed.
 * Runs in ci-fast-feedback.yml on every PR and before every deploy.
 */

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const RULES_FILE = join(process.cwd(), 'firestore.rules')

if (!existsSync(RULES_FILE)) {
  console.error(`✖ ${RULES_FILE} not found.`)
  process.exit(1)
}

const rules = readFileSync(RULES_FILE, 'utf8')

// Basic shape validation.
if (!/service\s+cloud\.firestore/.test(rules)) {
  console.error('✖ firestore.rules does not appear to declare `service cloud.firestore`.')
  process.exit(1)
}

const findings = []

const patterns = [
  {
    name: 'allow-if-true',
    regex:
      /allow\s+(?:read|write|create|update|delete|get|list)(?:\s*,\s*(?:read|write|create|update|delete|get|list))*\s*:\s*if\s+true\b/g,
    message: 'Rule allows access unconditionally. Replace with a real predicate.',
  },
  {
    name: 'temporary-time-rule',
    regex: /request\.time\s*<\s*timestamp\.date\(/g,
    message:
      'Temporary time-limited rule found. These are almost always forgotten. Replace with a real predicate.',
  },
]

for (const p of patterns) {
  for (const m of rules.matchAll(p.regex)) {
    const line = rules.slice(0, m.index).split('\n').length
    findings.push({ name: p.name, line, message: p.message })
  }
}

// Default-deny check: the last block must refuse everything not matched above.
if (
  !/match\s+\/\{document=\*\*\}\s*\{\s*allow\s+read\s*,\s*write\s*:\s*if\s+false\s*;/s.test(rules)
) {
  findings.push({
    name: 'missing-default-deny',
    line: rules.split('\n').length,
    message:
      'No default deny block found. Add `match /{document=**} { allow read, write: if false; }` as the last block.',
  })
}

if (findings.length) {
  console.error(
    `✖ firestore.rules failed lint (${findings.length} finding${findings.length === 1 ? '' : 's'}):`
  )
  for (const f of findings) {
    console.error(`  [${f.name}] firestore.rules:${f.line} — ${f.message}`)
  }
  process.exit(1)
}

console.log('✓ firestore.rules passed lint.')
