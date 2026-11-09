// The board's home: one card at a time for each thing waiting on James. Drag right to do what the
// card says, left for later, up for the details, down for the overview; the microphone changes
// the decision in his own words and the speaker reads the card aloud. Every move also has a
// button and a key. The design is docs/features/swipe-deck-prototype.html.
import { useEffect, useRef, useState } from 'react'
import CardStage from '../components/deck/CardStage.tsx'
import DeckDock from '../components/deck/DeckDock.tsx'
import DeckSheets from '../components/deck/DeckSheets.tsx'
import DeckTopBar from '../components/deck/DeckTopBar.tsx'
import EmptyDeck from '../components/deck/EmptyDeck.tsx'
import NewSessionButton from '../components/deck/NewSessionButton.tsx'
import NewSessionSheet from '../components/deck/NewSessionSheet.tsx'
import SpecBodies from '../components/deck/SpecBodies.tsx'
import TodoButton from '../components/deck/TodoButton.tsx'
import TodoDrawer from '../components/deck/TodoDrawer.tsx'
import WaitingLine from '../components/deck/WaitingLine.tsx'
import { useDeck } from '../components/deck/use-deck.ts'
import { useDeckActions } from '../components/deck/use-deck-actions.ts'
import { useDeckKeys, type Move } from '../components/deck/use-deck-keys.ts'
import { useDeckSheet } from '../components/deck/use-deck-sheet.ts'
import { useGhost } from '../components/deck/use-ghost.ts'
import type { Drag, Release } from '../components/deck/use-swipe.ts'
import { useTodoDrawer } from '../components/deck/use-todo-drawer.ts'
import { useToast } from '../components/deck/use-toast.ts'
import { refreshPush } from '../lib/push.ts'
import { defaultProjectId } from '../lib/use-new-session.ts'

export default function Deck() {
  const deck = useDeck()
  const toast = useToast()
  const sheets = useDeckSheet(deck.cards)
  const todos = useTodoDrawer(deck.tasks, deck.projects)
  const todoButton = useRef<HTMLButtonElement>(null)
  // The project the New session sheet opened with (null: closed).
  const [newSession, setNewSession] = useState<string | null>(null)
  const newSessionButton = useRef<HTMLButtonElement>(null)
  const { ghost, fly, landed } = useGhost()
  const actions = useDeckActions(deck, {
    fly,
    toast: toast.show,
    openSheet: sheets.open,
    closeSheet: sheets.close,
  })
  const top = deck.cards[0] ?? null
  // With notifications on, a token Chrome rotated replaces the stored one (once per visit).
  useEffect(() => void refreshPush(), [])

  function move(m: Move) {
    if (m === 'overview') return sheets.open('overview', null)
    if (!top) return
    if (m === 'later') actions.later(top, null)
    else if (m === 'agree') actions.agree(top, null)
    else if (m === 'details') sheets.open('details', top)
    else if (m === 'change') sheets.startNote(top)
    else if (m === 'listen' && sheets.canListen) sheets.toggleListen(top)
  }
  useDeckKeys(!sheets.modal && !todos.open && newSession === null, move)

  const openNewSession = () =>
    setNewSession(defaultProjectId(deck.projects, top?.projectId ?? null))
  function sessionStarted(name: string) {
    setNewSession(null)
    toast.show(`Starting a session for ${name}`)
    newSessionButton.current?.focus()
  }

  function onRelease(release: Release | null, drag: Drag) {
    if (!top || !release) return
    if (release === 'right') actions.agree(top, drag)
    else if (release === 'left') actions.later(top, drag)
    else if (release === 'up') sheets.open('details', top)
    else sheets.open('overview', null)
  }

  return (
    <div className="mx-auto flex h-dvh w-full max-w-(--content-max) flex-col overflow-hidden px-4 pt-safe pb-safe">
      <h1 className="sr-only">Decisions</h1>
      <SpecBodies tasks={deck.specTasks} onBody={deck.setSpecBody} />
      <DeckTopBar
        total={deck.cards.length}
        allPassed={deck.cards.length > 0 && deck.cards.every((c) => c.passed)}
        canListen={sheets.canListen}
        speaking={sheets.speaking}
        onOverview={() => move('overview')}
        onListen={() => move('listen')}
      />
      <WaitingLine waiting={deck.waiting.waiting} />
      <main aria-live="polite" className="flex min-h-0 flex-1 flex-col">
        {top ? (
          <CardStage
            top={top}
            back={deck.cards[1] ?? null}
            now={deck.now}
            ghost={ghost}
            onRelease={onRelease}
            onGhostDone={landed}
            onDetails={() => move('details')}
          />
        ) : (
          <EmptyDeck working={deck.working} />
        )}
      </main>
      <DeckDock
        start={<TodoButton ref={todoButton} open={todos.summary.open} onOpen={todos.show} />}
        end={<NewSessionButton ref={newSessionButton} onOpen={openNewSession} />}
        hasCard={top !== null}
        canChange={top !== null}
        onLater={() => move('later')}
        onAgree={() => move('agree')}
        onChange={() => move('change')}
      />
      <p
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-4 bottom-36 z-(--z-toast) mx-auto w-max max-w-[calc(100%-2rem)] rounded-lg bg-foreground px-4 py-2.5 text-center text-sm font-medium text-background empty:hidden"
      >
        {toast.message}
      </p>
      <DeckSheets
        sheet={sheets.sheet}
        card={sheets.card}
        deck={deck}
        voice={sheets.voice}
        canRecord={sheets.canRecord}
        reading={sheets.reading}
        actions={actions}
        onClose={sheets.close}
      />
      {todos.open ? (
        <TodoDrawer drawer={todos} now={deck.now} returnFocus={() => todoButton.current?.focus()} />
      ) : null}
      {newSession !== null ? (
        <NewSessionSheet
          projects={deck.projects}
          initialProjectId={newSession}
          onStarted={sessionStarted}
          onClose={() => setNewSession(null)}
          returnFocus={() => newSessionButton.current?.focus()}
        />
      ) : null}
    </div>
  )
}
