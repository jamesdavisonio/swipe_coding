#!/usr/bin/env node
/* scripts/check-audit.mjs
 * `npm audit --omit=dev` at high+, with an explicit, expiring allowlist.
 *
 * npm audit has no ignore list, and npm overrides cannot reach a workspace's dependency
 * tree, so an advisory we have judged unreachable would keep the gate red for months.
 * Instead each accepted advisory lives in scripts/audit-allowlist.json with a reason and an
 * expiry date; anything not listed, or listed but expired, fails. Runs in
 * security-gatekeeper.yml and via `npm run audit`.
 */

import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const ALLOWLIST_URL = new URL('./audit-allowlist.json', import.meta.url)
const BLOCKING = new Set(['high', 'critical'])

const allow = JSON.parse(readFileSync(ALLOWLIST_URL, 'utf8')).allow
const today = new Date().toISOString().slice(0, 10)

// npm exits 1 whenever it finds anything; the JSON report is still on stdout. A fixed
// command string through the shell, so `npm.cmd` resolves on Windows too.
let raw = ''
try {
  raw = execSync('npm audit --omit=dev --json', {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
} catch (err) {
  raw = err.stdout ?? ''
  if (!raw.trim()) {
    console.error(`✖ npm audit did not produce a report: ${err.stderr || err.message}`)
    process.exit(1)
  }
}

let report
try {
  report = JSON.parse(raw)
} catch {
  console.error('✖ npm audit output was not JSON:\n' + raw.slice(0, 2000))
  process.exit(1)
}
if (report.error) {
  console.error(`✖ npm audit failed: ${report.error.summary ?? JSON.stringify(report.error)}`)
  process.exit(1)
}

// Collect every advisory at a blocking severity. Advisories hang off `via` entries that are
// objects; string `via` entries just point at another vulnerable package, whose own entry
// we also visit.
const advisories = new Map()
for (const vuln of Object.values(report.vulnerabilities ?? {})) {
  for (const via of vuln.via ?? []) {
    if (typeof via !== 'object' || !BLOCKING.has(via.severity)) continue
    const id =
      String(via.url ?? '')
        .split('/')
        .pop() || `advisory-${via.source}`
    const seen = advisories.get(id)
    if (seen) seen.paths.add(vuln.name)
    else
      advisories.set(id, {
        id,
        severity: via.severity,
        pkg: via.name,
        title: via.title,
        paths: new Set([vuln.name]),
      })
  }
}

const blocking = []
const accepted = []
for (const a of advisories.values()) {
  const entry = allow.find((e) => e.id === a.id)
  if (!entry) blocking.push({ ...a, why: 'not in allowlist' })
  else if (entry.expires < today)
    blocking.push({ ...a, why: `allowlist entry expired ${entry.expires}` })
  else accepted.push({ ...a, entry })
}

for (const a of accepted) {
  console.log(
    `· accepted ${a.severity} ${a.id} (${a.pkg}) until ${a.entry.expires} — ${a.entry.reason}`
  )
}
if (blocking.length) {
  console.error(`✖ ${blocking.length} blocking advisor${blocking.length === 1 ? 'y' : 'ies'}:`)
  for (const a of blocking) {
    console.error(
      `  [${a.severity}] ${a.id} ${a.pkg} — ${a.title} (via ${[...a.paths].join(', ')}; ${a.why})`
    )
  }
  console.error('Fix, or add a reasoned, expiring entry to scripts/audit-allowlist.json.')
  process.exit(1)
}

const total = report.metadata?.vulnerabilities?.total ?? 0
console.log(
  `✓ audit gate passed: ${advisories.size} high+ advisor${advisories.size === 1 ? 'y' : 'ies'} (all allowlisted), ${total} findings in total at any severity.`
)
