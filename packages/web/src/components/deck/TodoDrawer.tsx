// The to-do drawer: a sheet from the bottom with one fold-out section per project (open count,
// "<d> done"), open to-dos first with tick boxes, then a "Done" line and the ticked ones, greyed
// and struck through. A row's text opens the to-do's own dialog above the sheet. The design is
// the mock-up James approved on 2026-11-08 (docs/features/todo-drawer.md).
import { useId, useRef, useState, type ReactNode } from 'react'
import { cn } from '../../lib/cn.ts'
import { ChevronRight } from '../../lib/icons.ts'
import { summaryLine, type TodoRow, type TodoSection } from '../../lib/todo-drawer.ts'
import DeckSheet from './DeckSheet.tsx'
import TodoDialog from './TodoDialog.tsx'
import type { TodoDrawerModel } from './use-todo-drawer.ts'

// No grey flash on a tapped row (iOS/Android draw it over whatever opens next).
const NO_TAP_HIGHLIGHT = '[-webkit-tap-highlight-color:transparent]'

function Row({
  row,
  onTick,
  onOpen,
  textRef,
}: {
  row: TodoRow
  onTick: () => void
  onOpen: () => void
  textRef: (el: HTMLButtonElement | null) => void
}) {
  const { todo } = row
  return (
    <li className="grid min-h-11 grid-cols-[2.75rem_minmax(0,1fr)] items-center">
      <label className={cn('grid size-11 cursor-pointer place-items-center', NO_TAP_HIGHLIGHT)}>
        <input
          type="checkbox"
          aria-label={`${todo.done ? 'Mark not done' : 'Mark done'}: ${todo.body}`}
          checked={todo.done}
          onChange={onTick}
          className="size-5.5 cursor-pointer accent-ok"
        />
      </label>
      <button
        ref={textRef}
        type="button"
        onClick={onOpen}
        className={cn(
          'min-h-11 truncate px-0.5 py-2.5 text-left',
          NO_TAP_HIGHLIGHT,
          todo.done && 'text-muted-foreground line-through decoration-muted-foreground/60'
        )}
      >
        {todo.body}
      </button>
    </li>
  )
}

function Section({
  section,
  expanded,
  onFold,
  renderRow,
}: {
  section: TodoSection
  expanded: boolean
  onFold: () => void
  renderRow: (row: TodoRow) => ReactNode
}) {
  const listId = useId()
  const { open, done } = section
  return (
    <section className="border-b border-muted last:border-b-0">
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={listId}
        onClick={onFold}
        className="grid min-h-14 w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5 py-1.5 text-left"
      >
        <ChevronRight
          aria-hidden="true"
          className={cn(
            'size-4.5 text-muted-foreground transition-transform duration-(--motion-fast)',
            expanded && 'rotate-90'
          )}
        />
        <span className="truncate font-mono font-semibold">{section.projectName}</span>{' '}
        <span className="flex items-center gap-1.5 text-sm text-muted-foreground tabular-nums">
          {open.length > 0 ? (
            <>
              <span className="rounded-full bg-tone-todo px-2 py-0.5 font-bold text-tone-todo-foreground">
                {open.length}
                <span className="sr-only"> open</span>
              </span>{' '}
            </>
          ) : null}
          <span>{`${done.length} done`}</span>
        </span>
      </button>
      <ul id={listId} hidden={!expanded} className="mb-3 grid gap-0.5">
        {open.map(renderRow)}
        {done.length > 0 ? (
          <li
            key="done"
            aria-hidden="true"
            className="pt-2.5 pb-1 pl-11.5 text-xs font-semibold tracking-widest text-muted-foreground uppercase"
          >
            Done
          </li>
        ) : null}
        {done.map(renderRow)}
      </ul>
    </section>
  )
}

// A section with open to-dos starts expanded, one without collapsed, as the drawer opens; it then
// keeps its fold while rows are ticked, until James taps its header.
function useFolds(sections: readonly TodoSection[]) {
  const [atOpen] = useState(() => new Map(sections.map((s) => [s.projectId, s.open.length > 0])))
  const [tapped, setTapped] = useState<ReadonlyMap<string, boolean>>(new Map())
  const expanded = (s: TodoSection) =>
    tapped.get(s.projectId) ?? atOpen.get(s.projectId) ?? s.open.length > 0
  const fold = (s: TodoSection) => setTapped((m) => new Map(m).set(s.projectId, !expanded(s)))
  return { expanded, fold }
}

function findRow(sections: readonly TodoSection[], id: string | null) {
  for (const section of sections) {
    const row = [...section.open, ...section.done].find((r) => r.todo.id === id)
    if (row) return { row, section }
  }
  return null
}

export default function TodoDrawer({
  drawer,
  now,
  returnFocus,
}: {
  drawer: TodoDrawerModel
  now: number
  // Back to the to-do button once the drawer has closed.
  returnFocus: () => void
}) {
  const { sections } = drawer
  const folds = useFolds(sections)
  const [itemId, setItemId] = useState<string | null>(null)
  const item = findRow(sections, itemId)
  // Each row's text button, so the to-do dialog can hand focus back to it wherever the row went.
  const textButtons = useRef(new Map<string, HTMLButtonElement>())

  const renderRow = (r: TodoRow) => {
    const { id } = r.todo
    return (
      <Row
        key={id}
        row={r}
        onTick={() => drawer.toggle(r.todo)}
        onOpen={() => setItemId(id)}
        textRef={(el) => {
          if (el) textButtons.current.set(id, el)
          else textButtons.current.delete(id)
        }}
      />
    )
  }

  return (
    <>
      <DeckSheet
        title="To-dos"
        summary={summaryLine(drawer.summary)}
        closeLabel="Close to-dos"
        pinHeader
        onClose={drawer.hide}
        returnFocus={returnFocus}
      >
        {sections.length === 0 ? (
          <p className="py-4 text-muted-foreground">No to-dos yet.</p>
        ) : (
          sections.map((s) => (
            <Section
              key={s.projectId}
              section={s}
              expanded={folds.expanded(s)}
              onFold={() => folds.fold(s)}
              renderRow={renderRow}
            />
          ))
        )}
      </DeckSheet>
      {item ? (
        <TodoDialog
          row={item.row}
          projectName={item.section.projectName}
          now={now}
          onToggle={() => {
            drawer.toggle(item.row.todo)
            setItemId(null)
          }}
          onClose={() => setItemId(null)}
          returnFocus={() => textButtons.current.get(item.row.todo.id)?.focus()}
        />
      ) : null}
    </>
  )
}
