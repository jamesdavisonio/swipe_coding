// Whichever deck sheet is open, wired to the deck's moves.
import type { DeckCard } from '../../lib/deck.ts'
import ChoicesSheet from './ChoicesSheet.tsx'
import DetailsSheet from './DetailsSheet.tsx'
import HoldSheet from './HoldSheet.tsx'
import ListenSheet from './ListenSheet.tsx'
import OverviewSheet from './OverviewSheet.tsx'
import VoiceSheet from './VoiceSheet.tsx'
import type { DeckActions } from './use-deck-actions.ts'
import type { DeckModel } from './use-deck.ts'
import type { Reading } from './use-listen.ts'
import type { Recognition } from './use-recognition.ts'

export type SheetKind = 'details' | 'overview' | 'choices' | 'hold' | 'voice' | 'listen'
export interface OpenSheet {
  kind: SheetKind
  cardId: string | null
}

export default function DeckSheets({
  sheet,
  card,
  deck,
  voice,
  canRecord,
  reading,
  actions,
  onClose,
}: {
  sheet: OpenSheet | null
  card: DeckCard | null
  deck: DeckModel
  voice: Recognition
  canRecord: boolean
  reading: Reading | null
  actions: DeckActions
  onClose: () => void
}) {
  if (sheet?.kind === 'overview')
    return (
      <OverviewSheet
        deck={deck.cards}
        working={deck.working}
        onProject={(projectId) => {
          deck.putFirst(projectId)
          onClose()
        }}
        onClose={onClose}
      />
    )
  if (!sheet || !card) return null
  switch (sheet.kind) {
    case 'details': {
      const task = deck.taskOf(card.taskId)
      return (
        <DetailsSheet
          card={card}
          task={task}
          remoteUrl={deck.remoteUrlOf(task)}
          onClose={onClose}
        />
      )
    }
    case 'choices':
      return (
        <ChoicesSheet
          card={card}
          onChoose={(choice) => actions.choose(card, choice)}
          onClose={onClose}
        />
      )
    case 'hold':
      return <HoldSheet card={card} onConfirm={() => actions.merge(card)} onClose={onClose} />
    case 'voice':
      return (
        <VoiceSheet
          card={card}
          voice={voice}
          canRecord={canRecord}
          onSend={(text) => actions.note(card, text)}
          onClose={onClose}
        />
      )
    case 'listen':
      return reading ? <ListenSheet card={card} reading={reading} onClose={onClose} /> : null
    default:
      return null
  }
}
