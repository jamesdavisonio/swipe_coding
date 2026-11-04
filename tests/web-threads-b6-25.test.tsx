// @vitest-environment jsdom
// web-threads B6, criterion 25: the History sheet. A dialog named "Decision history" with the
// task title as its heading lists the task's decision log oldest first, each entry with who (You /
// Session / Board), its time ("Today HH:MM", "Yesterday HH:MM", "<day> <Mon> HH:MM") and its
// text; "Nothing recorded yet." when the log is empty; chat messages never appear in it. When the
// log is at LOG_CAP, "Show earlier history" reads tasks/{id}/log_archive and lists those entries
// above the rest. A done task's sheet offers "Reopen task". It opens from the thread's Decision
// history button and from a done task's History button on the project's Done tab, and opening
// it is not logged. The archive read itself is tested in the emulator
// (tests/emulator/web-threads-b6-25.test.ts).
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LOG_CAP, type LogEntry, type Task } from '../packages/shared/src/index.ts'
import HistorySheet from '../packages/web/src/components/HistorySheet.tsx'
import Project from '../packages/web/src/pages/Project.tsx'
import Thread from '../packages/web/src/pages/Thread.tsx'
import { DAY, HOUR, MINUTE, NOW, installClock, live, logSpy } from './fixtures/web-threads-b2.tsx'
import { jamesMsg, sessionMsg } from './fixtures/web-threads-b3.tsx'
import { renderB5, taskCard, textIn } from './fixtures/web-threads-b5.tsx'
import {
  WHO,
  doneTask,
  entry,
  entryIn,
  lines,
  posOf,
  setArchive,
  setB6,
  stamp,
} from './fixtures/web-threads-b6.tsx'

vi.mock('../packages/web/src/data.ts', async () =>
  (await import('./fixtures/web-threads-b6.tsx')).dataModule()
)
vi.mock('../packages/web/src/lib/log.ts', async () =>
  (await import('./fixtures/web-threads-b2.tsx')).logModule()
)
vi.mock('../packages/web/src/components/DecisionSheet.tsx', async () =>
  (await import('./fixtures/web-threads-b2.tsx')).sheetModule()
)
vi.mock('../packages/web/src/firebase.ts', () => ({ app: {}, auth: {}, db: {} }))

const SHEET = 'Decision history'
const EMPTY = 'Nothing recorded yet.'
const sheet = () => screen.getByRole('dialog', { name: SHEET })

// The sheet on its own, as the project's Done tab would mount it.
function openAlone(task: Task, archived?: LogEntry[]) {
  setB6(task)
  if (archived) setArchive(live(archived))
  const onClose = vi.fn()
  renderB5('/p/p-kanban?tab=done', {
    '/p/:projectId': <HistorySheet task={task} onClose={onClose} />,
  })
  return { onClose, user: userEvent.setup() }
}

// One entry of each kind of author, ten days ago, yesterday and today.
const LOG: LogEntry[] = [
  entry(NOW - 10 * DAY, 'james', 'Queued: Ship the nav'),
  entry(NOW - DAY, 'session', 'Spec v1 ready'),
  entry(NOW - 2 * HOUR, 'james', 'Approved spec v1'),
  entry(NOW - HOUR, 'system', 'Closed after deploy'),
]

// Each entry sits in its own element with its who, its stamp and its text, and no other entry.
function expectEntries(root: HTMLElement, entries: readonly LogEntry[]) {
  for (const e of entries) {
    const holder = entryIn(root, e)
    const text = textIn(holder)
    expect(text).toContain(WHO[e.who])
    expect(text).toContain(stamp(e.at))
    for (const other of entries.filter((o) => o !== e)) expect(text).not.toContain(other.text)
  }
}

describe('B6-25 the History sheet', () => {
  installClock()

  it('is a dialog named Decision history with the task title as its heading', () => {
    openAlone(doneTask({ log: LOG }))
    expect(within(sheet()).getByRole('heading', { name: 'Ship the nav' })).toBeTruthy()
  })

  it('lists the entries oldest first, each with who, time and text', () => {
    openAlone(doneTask({ log: LOG }))
    const root = sheet()
    const order = LOG.map((e) => posOf(root, e.text))
    expect(order.every((p) => p >= 0)).toBe(true)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
    expectEntries(root, LOG)
  })

  it('names the author: You for James, Session for the session, Board for the system', () => {
    openAlone(doneTask({ log: LOG }))
    const root = sheet()
    expect(textIn(entryIn(root, LOG[0]))).toContain('You')
    expect(textIn(entryIn(root, LOG[1]))).toContain('Session')
    expect(textIn(entryIn(root, LOG[3]))).toContain('Board')
  })

  it('stamps today, yesterday and older entries as the prototype does', () => {
    openAlone(doneTask({ log: LOG }))
    const root = sheet()
    expect(stamp(LOG[2].at)).toMatch(/^Today \d\d:\d\d$/)
    expect(stamp(LOG[1].at)).toMatch(/^Yesterday \d\d:\d\d$/)
    expect(stamp(LOG[0].at)).toMatch(/^\d{1,2} [A-Z][a-z]{2} \d\d:\d\d$/)
    for (const e of LOG) expect(textIn(entryIn(root, e))).toContain(stamp(e.at))
  })

  it('says "Nothing recorded yet." when the log is empty', () => {
    openAlone(doneTask({ log: [] }))
    expect(textIn(sheet())).toContain(EMPTY)
  })

  it('does not say "Nothing recorded yet." when there are entries', () => {
    openAlone(doneTask({ log: LOG }))
    expect(textIn(sheet())).toContain('Approved spec v1')
    expect(textIn(sheet())).not.toContain(EMPTY)
  })

  it('offers Reopen task on a done task', () => {
    openAlone(doneTask({ log: LOG }))
    expect(within(sheet()).getByRole('button', { name: 'Reopen task' })).toBeTruthy()
  })

  it('has no Reopen task on a task still in flight', () => {
    openAlone(doneTask({ log: LOG, stage: 'main_ci', doneAt: null }))
    expect(textIn(sheet())).toContain('Approved spec v1')
    expect(within(sheet()).queryByRole('button', { name: 'Reopen task' })).toBeNull()
  })
})

// Runs the describe under a time zone away from UTC and a default locale that writes the month
// first on a 12-hour clock: the stamps must still be "<day> <Mon> HH:MM" in that time zone.
function underForeignClock(timeZone: string, locale: string) {
  const saved = {
    tz: process.env.TZ,
    format: Intl.DateTimeFormat,
    date: Reflect.get(Date.prototype, 'toLocaleDateString'),
    time: Reflect.get(Date.prototype, 'toLocaleTimeString'),
    both: Reflect.get(Date.prototype, 'toLocaleString'),
  }
  // No locale given, an empty list, or tags ICU does not support ('default', 'und'): all mean the
  // runtime default, which is `locale` here. Supported tags ('en-GB', 'fr-FR') pass through.
  const orDefault = (loc?: string | string[]) =>
    loc === undefined || saved.format.supportedLocalesOf(loc).length === 0 ? locale : loc
  beforeAll(() => {
    process.env.TZ = timeZone
    const Format = function (loc?: string | string[], opts?: Intl.DateTimeFormatOptions) {
      return new saved.format(orDefault(loc), opts)
    } as unknown as typeof Intl.DateTimeFormat
    Object.assign(Format, {
      supportedLocalesOf: saved.format.supportedLocalesOf.bind(saved.format),
    })
    Object.defineProperty(Format, 'prototype', { value: saved.format.prototype })
    Intl.DateTimeFormat = Format
    const proto = Date.prototype
    proto.toLocaleDateString = function (this: Date, loc?: string | string[], opts?: object) {
      return saved.date.call(this, orDefault(loc), opts)
    }
    proto.toLocaleTimeString = function (this: Date, loc?: string | string[], opts?: object) {
      return saved.time.call(this, orDefault(loc), opts)
    }
    proto.toLocaleString = function (this: Date, loc?: string | string[], opts?: object) {
      return saved.both.call(this, orDefault(loc), opts)
    }
  })
  afterAll(() => {
    if (saved.tz === undefined) delete process.env.TZ
    else process.env.TZ = saved.tz
    Intl.DateTimeFormat = saved.format
    Date.prototype.toLocaleDateString = saved.date
    Date.prototype.toLocaleTimeString = saved.time
    Date.prototype.toLocaleString = saved.both
  })
}

describe('B6-25 opening the History sheet', () => {
  installClock()

  const COMMENTS = [
    sessionMsg('c1', 'spec', 'Here is the nav spec', NOW - DAY - HOUR),
    jamesMsg('c2', 'Looks right to me', NOW - DAY + MINUTE),
    sessionMsg('c3', 'done', 'Shipped the nav', NOW - HOUR),
  ]

  it("opens from the thread's Decision history button, listing entries and never messages", async () => {
    const task = doneTask({ log: LOG })
    setB6(task, { comments: COMMENTS })
    renderB5('/t/t1', { '/t/:taskId': <Thread /> })
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: SHEET }))
    const root = await screen.findByRole('dialog', { name: SHEET })
    expect(within(root).getByRole('heading', { name: 'Ship the nav' })).toBeTruthy()
    expectEntries(root, LOG)
    for (const c of COMMENTS) expect(textIn(root)).not.toContain(c.body)
  })

  it('logs nothing when it opens', async () => {
    const task = doneTask({ log: LOG })
    setB6(task, { comments: COMMENTS })
    renderB5('/t/t1', { '/t/:taskId': <Thread /> })
    await userEvent.setup().click(screen.getByRole('button', { name: SHEET }))
    await screen.findByRole('dialog', { name: SHEET })
    expect(logSpy.event).not.toHaveBeenCalled()
  })

  it("opens from a done task's History button on the project's Done tab", async () => {
    const other = doneTask({
      title: 'Add search',
      doneAt: NOW - DAY,
      log: [entry(NOW - DAY, 'james', 'Queued: Add search')],
    })
    const task = doneTask({ log: LOG })
    setB6(task, { tasks: [{ ...other, id: 't2' }, task] })
    renderB5('/p/p-kanban?tab=done', {
      '/p/:projectId': <Project />,
      '/t/:taskId': <Thread />,
    })
    const user = userEvent.setup()
    await user.click(within(taskCard('t1')).getByRole('button', { name: /^History/ }))
    const root = await screen.findByRole('dialog', { name: SHEET })
    expect(within(root).getByRole('heading', { name: 'Ship the nav' })).toBeTruthy()
    expectEntries(root, LOG)
    expect(textIn(root)).not.toContain('Queued: Add search')
  })
})

describe('B6-25 earlier history from the archive', () => {
  installClock()

  const ARCHIVED = [
    entry(NOW - 40 * DAY, 'session', 'Archived plan.'),
    entry(NOW - 39 * DAY, 'james', 'Archived scope.'),
  ]
  const FULL = lines(LOG_CAP)

  it('offers Show earlier history only when the log is at LOG_CAP', () => {
    openAlone(doneTask({ log: lines(LOG_CAP - 1) }))
    expect(textIn(sheet())).toContain(`Line ${LOG_CAP - 2}.`)
    expect(within(sheet()).queryByRole('button', { name: 'Show earlier history' })).toBeNull()
  })

  it('offers Show earlier history on a full log', () => {
    openAlone(doneTask({ log: FULL }))
    expect(within(sheet()).getByRole('button', { name: 'Show earlier history' })).toBeTruthy()
  })

  it('lists the archived entries above the rest once asked, not before', async () => {
    const { user } = openAlone(doneTask({ log: FULL }), ARCHIVED)
    expect(textIn(sheet())).not.toContain('Archived plan.')
    await user.click(within(sheet()).getByRole('button', { name: 'Show earlier history' }))
    const root = sheet()
    const order = ['Archived plan.', 'Archived scope.', 'Line 0.', `Line ${LOG_CAP - 1}.`].map(
      (text) => posOf(root, text)
    )
    expect(order.every((p) => p >= 0)).toBe(true)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
    expectEntries(root, [...ARCHIVED, FULL[0]])
  })
})

// This describe must stay the last one in the file: it resets the module registry and
// re-registers the mocks so the app is evaluated afresh under the stubbed clock. Anything the
// app loads after that binds to fresh fixture instances that the static setB6, setArchive and
// logSpy used by the other describes neither control nor observe. Its afterAll undoes the
// re-registered mocks and resets the registry again, but nothing should run after it.
// The app and fixture modules as evaluated after the foreign clock is installed, so even a
// formatter an app module builds at its top level sees the stubbed time zone and locale.
interface Fresh {
  HistorySheet: typeof HistorySheet
  b6: typeof import('./fixtures/web-threads-b6.tsx')
  b2: typeof import('./fixtures/web-threads-b2.tsx')
  data: Record<string, unknown>
  log: Record<string, unknown>
  firebase: Record<string, unknown>
}

describe('B6-25 stamps in another time zone and locale', () => {
  underForeignClock('America/Los_Angeles', 'en-US')
  let fresh: Fresh
  // Runs after underForeignClock's beforeAll (hooks run in the order they are declared).
  beforeAll(async () => {
    vi.resetModules()
    // resetModules keeps the mocks' cached instances, so re-register the same mocks: the fresh
    // data.ts and logger then come from the fresh fixtures, built under the stubbed clock too.
    vi.doMock('../packages/web/src/data.ts', async () =>
      (await import('./fixtures/web-threads-b6.tsx')).dataModule()
    )
    vi.doMock('../packages/web/src/lib/log.ts', async () =>
      (await import('./fixtures/web-threads-b2.tsx')).logModule()
    )
    vi.doMock('../packages/web/src/components/DecisionSheet.tsx', async () =>
      (await import('./fixtures/web-threads-b2.tsx')).sheetModule()
    )
    vi.doMock('../packages/web/src/firebase.ts', () => ({ app: {}, auth: {}, db: {} }))
    fresh = {
      HistorySheet: (await import('../packages/web/src/components/HistorySheet.tsx')).default,
      b6: await import('./fixtures/web-threads-b6.tsx'),
      b2: await import('./fixtures/web-threads-b2.tsx'),
      data: await import('../packages/web/src/data.ts'),
      log: await import('../packages/web/src/lib/log.ts'),
      firebase: await import('../packages/web/src/firebase.ts'),
    }
  })
  // Undo the re-registered mocks and drop the fresh instances, so nothing leaks past this describe.
  afterAll(() => {
    vi.doUnmock('../packages/web/src/data.ts')
    vi.doUnmock('../packages/web/src/lib/log.ts')
    vi.doUnmock('../packages/web/src/components/DecisionSheet.tsx')
    vi.doUnmock('../packages/web/src/firebase.ts')
    vi.resetModules()
  })
  installClock()

  // The fresh sheet on its own, with the fresh fixture's board (the one the fresh data.ts mock reads).
  function openFresh(task: Task) {
    fresh.b6.setB6(task)
    const Sheet = fresh.HistorySheet
    renderB5('/p/p-kanban?tab=done', {
      '/p/:projectId': <Sheet task={task} onClose={vi.fn()} />,
    })
  }

  it('re-imports the app after the stubs, with data.ts, the logger and firebase still mocked', () => {
    expect(fresh.HistorySheet).not.toBe(HistorySheet)
    expect(fresh.data.reopenTask).toBe(fresh.b6.b6Actions.reopenTask)
    expect(typeof fresh.data.useLogArchive).toBe('function')
    expect(fresh.log.log).toBe(fresh.b2.logSpy)
    expect(fresh.firebase.db).toEqual({})
  })

  it('a formatter built at module scope after the stubs resolves to en-US in that time zone', () => {
    const format = fresh.b6.MODULE_SCOPE_DAY_FORMAT
    expect(format.resolvedOptions().locale).toBe('en-US')
    expect(format.resolvedOptions().timeZone).toBe('America/Los_Angeles')
    expect(format.format(new Date(NOW - 10 * DAY))).toMatch(/^Oct \d{1,2}$/)
  })

  it('the device really is away from UTC on a month-first 12-hour default', () => {
    // Pacific Standard Time on 3 Nov 2026: UTC-8.
    expect(new Date(NOW).getTimezoneOffset()).toBe(480)
    expect(new Intl.DateTimeFormat().resolvedOptions().locale).toBe('en-US')
    expect(new Date(NOW).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })).toMatch(
      /^[A-Z][a-z]{2} \d/
    )
    expect(new Date(NOW).toLocaleTimeString()).toMatch(/[AP]M/)
    // An empty locale list means the default too.
    expect(new Intl.DateTimeFormat([]).resolvedOptions().locale).toBe('en-US')
    expect(new Date(NOW).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })).toMatch(
      /[AP]M/
    )
    // So does a tag ICU does not support.
    expect(new Intl.DateTimeFormat('default').resolvedOptions().locale).toBe('en-US')
    expect(new Intl.DateTimeFormat('und').resolvedOptions().locale).toBe('en-US')
    expect(
      new Date(NOW).toLocaleTimeString('default', { hour: '2-digit', minute: '2-digit' })
    ).toMatch(/[AP]M/)
  })

  it('still stamps "Today HH:MM", "Yesterday HH:MM" and "<day> <Mon> HH:MM" in local time', () => {
    openFresh(fresh.b6.doneTask({ log: LOG }))
    const root = sheet()
    expect(stamp(LOG[2].at)).toMatch(/^Today \d\d:\d\d$/)
    expect(stamp(LOG[1].at)).toMatch(/^Yesterday \d\d:\d\d$/)
    expect(stamp(LOG[0].at)).toMatch(/^\d{1,2} [A-Z][a-z]{2} \d\d:\d\d$/)
    for (const e of LOG) expect(textIn(entryIn(root, e))).toContain(stamp(e.at))
    // No 12-hour clock anywhere in the sheet.
    expect(textIn(root)).not.toMatch(/\d ?[AP]M\b/)
  })
})
