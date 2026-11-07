// What the deck says aloud, and whether this browser can listen and speak. Pure apart from the
// feature check on `window`: the Deck screen owns the recognizer and the utterance.
import { BRIEF_SECTIONS } from './brief.ts'
import type { DeckCard } from './deck.ts'

// Markdown symbols a session may leave in its text; read aloud they are noise.
const MARKDOWN_SYMBOLS = /[#*`]/g
const SENTENCE_END = /[.!?…]$/

// The text as one spoken sentence: markdown symbols out, a full stop at the end.
function sentence(text: string): string {
  const plain = text.replace(MARKDOWN_SYMBOLS, '').replace(/\s+/g, ' ').trim()
  if (plain === '') return ''
  return SENTENCE_END.test(plain) ? plain : `${plain}.`
}

// The card read aloud: where it came from (project and session), the headline, the example,
// then each part of its brief that has words, under its own heading.
export function listenScript(card: DeckCard): string {
  const parts = BRIEF_SECTIONS.map(({ key, heading }) => {
    const text = card.brief?.parts[key] ?? ''
    return text.trim() === '' ? '' : sentence(`${heading}: ${text}`)
  })
  return [
    sentence(`From ${card.projectName}, ${card.session}`),
    sentence(card.headline),
    card.example ? sentence(`For example, ${card.example}`) : '',
    ...parts,
  ]
    .filter((s) => s !== '')
    .join(' ')
}

// Speech recognition (standard or webkit-prefixed) and speech synthesis, as this browser has them.
export function speechSupport(): { recognition: boolean; synthesis: boolean } {
  const w = window as unknown as Record<string, unknown>
  return {
    recognition: Boolean(w.SpeechRecognition ?? w.webkitSpeechRecognition),
    synthesis: Boolean(w.speechSynthesis) && typeof w.SpeechSynthesisUtterance === 'function',
  }
}
