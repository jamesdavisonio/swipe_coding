// The stage: the top card under the finger, the next card waiting behind it (it grows as the top
// one is dragged away), and the copy of a card that was just acted on, flying off.
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import type { DeckCard } from '../../lib/deck.ts'
import DeckCardFace from './DeckCardFace.tsx'
import { buzz, HAPTIC, motionMs } from './motion.ts'
import { swipeProgress, useSwipe, type Drag, type Release } from './use-swipe.ts'

// How a dragged card moves (from the prototype): it tilts one degree per 20px, a vertical drag
// only nudges.
const TILT_PX_PER_DEG = 20
const NUDGE_SHARE = 0.18
// Where the card behind sits until the top one is dragged off.
const BACK_SCALE = 0.94
const BACK_DROP_PX = 16
// How a card leaves: off to the side, tilted, or (after a note) up and away.
const FLY_SIDE = '140%'
const FLY_TILT_DEG = 26
const FLY_UP = '-115%'
const FLY_UP_SCALE = 0.92

export interface Ghost {
  key: number
  card: DeckCard
  to: 'right' | 'left' | 'up'
  from: Drag | null
}

function offset(drag: Drag | null): { x: number; y: number; deg: number } {
  if (!drag) return { x: 0, y: 0, deg: 0 }
  if (drag.axis === 'y') return { x: 0, y: drag.dy * NUDGE_SHARE, deg: 0 }
  const x = drag.dx
  return { x, y: 0, deg: x / TILT_PX_PER_DEG }
}

const transformOf = ({ x, y, deg }: { x: number; y: number; deg: number }) =>
  x === 0 && y === 0 ? undefined : `translate(${x}px, ${y}px) rotate(${deg}deg)`

const backTransform = (pull: number) =>
  `scale(${BACK_SCALE + (1 - BACK_SCALE) * pull}) translateY(${BACK_DROP_PX * (1 - pull)}px)`

function flyStyle(ghost: Ghost): CSSProperties {
  const from = offset(ghost.from)
  const side = ghost.to === 'right' ? 1 : -1
  const vars: Record<string, string> = {
    '--fly-from-x': `${from.x}px`,
    '--fly-from-y': `${from.y}px`,
    '--fly-from-r': `${from.deg}deg`,
  }
  if (ghost.to === 'up')
    Object.assign(vars, {
      '--fly-to-y': FLY_UP,
      '--fly-to-s': `${FLY_UP_SCALE}`,
      '--fly-to-o': '0',
    })
  else
    Object.assign(vars, {
      '--fly-to-x': side > 0 ? FLY_SIDE : `-${FLY_SIDE}`,
      '--fly-to-r': `${side * FLY_TILT_DEG}deg`,
    })
  return vars
}

function FlyingCard({
  ghost,
  now,
  onDone,
}: {
  ghost: Ghost
  now: number
  onDone: (key: number) => void
}) {
  useEffect(() => {
    const id = setTimeout(() => onDone(ghost.key), motionMs('--motion-slow'))
    return () => clearTimeout(id)
  }, [ghost.key, onDone])
  const progress = ghost.to === 'right' ? 1 : ghost.to === 'left' ? -1 : 0
  return (
    <DeckCardFace
      card={ghost.card}
      now={now}
      face="ghost"
      progress={progress}
      data-slot="deck-ghost"
      className="pointer-events-none z-30"
      style={flyStyle(ghost)}
    />
  )
}

export default function CardStage({
  top,
  back,
  now,
  ghost,
  onRelease,
  onGhostDone,
  onDetails,
}: {
  top: DeckCard
  back: DeckCard | null
  now: number
  ghost: Ghost | null
  onRelease: (release: Release | null, drag: Drag) => void
  onGhostDone: (key: number) => void
  onDetails: () => void
}) {
  const stage = useRef<HTMLDivElement>(null)
  const width = () => stage.current?.clientWidth ?? 0
  const { drag, handlers } = useSwipe({ enabled: true, width, onRelease })
  const progress = drag?.axis === 'x' ? swipeProgress(drag.dx, width()) : 0
  const armed = progress >= 1 ? 1 : progress <= -1 ? -1 : 0
  // A new top card rises from the back once; a drag ends that, so letting go never replays it.
  const [risen, setRisen] = useState<string | null>(null)
  const entering = risen !== top.id && !drag

  useEffect(() => {
    if (armed !== 0) buzz(HAPTIC.armed)
  }, [armed])

  useEffect(() => {
    if (drag) setRisen(top.id)
  }, [drag, top.id])

  return (
    <div ref={stage} className="relative min-h-0 flex-1 touch-none">
      {back ? (
        <DeckCardFace
          key={`back:${back.id}`}
          card={back}
          now={now}
          face="back"
          className={
            drag
              ? 'saturate-80 brightness-97'
              : 'saturate-80 brightness-97 transition-transform duration-(--motion-slow)'
          }
          style={{ transform: backTransform(Math.abs(progress)) }}
        />
      ) : null}
      <DeckCardFace
        key={top.id}
        card={top}
        now={now}
        face="top"
        progress={progress}
        onDetails={onDetails}
        data-slot="deck-card"
        data-enter={entering ? 'true' : undefined}
        onAnimationEnd={() => setRisen(top.id)}
        className={drag ? undefined : 'transition-transform duration-(--motion-slow) ease-spring'}
        style={{ transform: transformOf(offset(drag)) }}
        {...handlers}
      />
      {ghost ? <FlyingCard key={ghost.key} ghost={ghost} now={now} onDone={onGhostDone} /> : null}
    </div>
  )
}
