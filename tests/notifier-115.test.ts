// notifier 115: `npm run notifier` runs the notifier with Node's watch mode, so a change to its code
// or anything it imports restarts it; `npm run notifier:install` registers a Windows logon task
// that runs it from this folder (hidden window, restart on failure), and `npm run notifier:uninstall`
// removes it. What can be seen without Windows or the emulator: the root package.json scripts and
// the task script's code (the PowerShell itself is not run; the command line is run in
// tests/emulator/notifier-115-cli.test.ts).
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = join(import.meta.dirname, '..')
const scripts = (
  JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as {
    scripts: Record<string, string>
  }
).scripts
const taskScript = join(ROOT, 'scripts', 'notifier-task.ps1')

interface Line {
  code: string // what runs: strings kept, the trailing comment dropped
  calls: string // the same with every quoted string blanked, so only real calls and parameters remain
}

// One line, scanned character by character: '...' strings (with '' as an escaped quote) and "..."
// strings (with a backtick escape) end at the end of the line at the latest, and a # outside a
// string starts a comment that runs to the end of the line.
function scan(line: string): Line {
  let code = ''
  let calls = ''
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '#') break
    if (ch !== "'" && ch !== '"') {
      code += ch
      calls += ch
      continue
    }
    code += ch
    calls += '""'
    for (i++; i < line.length; i++) {
      const c = line[i]
      code += c
      if (ch === '"' && c === '`' && i + 1 < line.length) code += line[++i]
      else if (ch === "'" && c === "'" && line[i + 1] === "'") code += line[++i]
      else if (c === ch) break
    }
  }
  return { code, calls }
}

// The script, line by line: block comments and here-strings removed first.
const scriptLines = (): Line[] =>
  readFileSync(taskScript, 'utf8')
    .replace(/<#[\s\S]*?#>/g, '')
    .replace(/@"[\s\S]*?"@|@'[\s\S]*?'@/g, '')
    .split(/\r?\n/)
    .map(scan)
const code = () =>
  scriptLines()
    .map((l) => l.code)
    .join('\n')
const calls = () =>
  scriptLines()
    .map((l) => l.calls)
    .join('\n')

describe('notifier 115: running and installing it', () => {
  it('npm run notifier runs the notifier with node --watch', () => {
    expect(scripts.notifier).toBe('node --watch packages/agent/src/notifier.ts')
    expect(existsSync(join(ROOT, 'packages', 'agent', 'src', 'notifier.ts'))).toBe(true)
  })

  it('notifier:install and notifier:uninstall call the task script', () => {
    expect(scripts['notifier:install']).toBe('powershell -File scripts/notifier-task.ps1 install')
    expect(scripts['notifier:uninstall']).toBe(
      'powershell -File scripts/notifier-task.ps1 uninstall'
    )
  })

  it('the task script exists and registers and unregisters the task kanban-notifier', () => {
    expect(existsSync(taskScript)).toBe(true)
    expect(code()).toMatch(/\binstall\b/)
    expect(code()).toMatch(/\buninstall\b/)
    expect(code()).toMatch(/Register-ScheduledTask\b[^\n]*-TaskName\s+'kanban-notifier'/i)
    expect(code()).toMatch(/Unregister-ScheduledTask\b[^\n]*-TaskName\s+'kanban-notifier'/i)
    expect(calls()).toMatch(/^\s*(\$\w+\s*=\s*)?Register-ScheduledTask\b[^\n]*-TaskName\b/im)
    expect(calls()).toMatch(/^\s*(\$\w+\s*=\s*)?Unregister-ScheduledTask\b[^\n]*-TaskName\b/im)
  })

  it('the task runs at logon and restarts on failure', () => {
    expect(calls()).toMatch(/New-ScheduledTaskTrigger\b[^\n]*-AtLogOn\b/i)
    const settings = /New-ScheduledTaskSettingsSet\b[^\n]*/i.exec(calls())?.[0] ?? ''
    expect(settings).toMatch(/-RestartCount\b/i)
  })

  it('the task action runs powershell hidden with npm run notifier, in this folder', () => {
    const lines = scriptLines()
    // The action line is the one whose code outside strings calls the cmdlet ...
    const at = lines.findIndex((l) => /\bNew-ScheduledTaskAction\b/i.test(l.calls))
    expect(at).toBeGreaterThanOrEqual(0)
    // ... and its own parameters and strings are the contract's command line.
    expect(lines[at].calls).toMatch(/-WorkingDirectory\b/i)
    expect(lines[at].code).toMatch(/-Execute\s+'powershell(\.exe)?'/i)
    expect(lines[at].code).toMatch(
      /-Argument\s+'[^']*-WindowStyle\s+Hidden[^']*npm run notifier[^']*'/i
    )
  })

  it('the other root scripts are unchanged', () => {
    expect(scripts.agent).toBe('npm run start -w @kanban/agent')
    expect(scripts['test:rules']).toContain('vitest run --config vitest.rules.config.ts')
  })
})
