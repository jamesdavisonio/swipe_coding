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

// The slice of the Web Speech recognition API the deck uses. TypeScript's DOM library does not
// ship it, so it is declared here once, on Window, as optional (most browsers lack one or both).
export interface RecognitionTranscript {
  transcript: string
}
export type RecognitionResult = ArrayLike<RecognitionTranscript> & { isFinal: boolean }
export interface RecognitionEvent {
  results: ArrayLike<RecognitionResult>
}
export interface Recognizer {
  continuous: boolean
  interimResults: boolean
  lang: string
  start: () => void
  stop: () => void
  abort: () => void
  onresult: ((e: RecognitionEvent) => void) | null
  onend: (() => void) | null
  onerror: ((e: { error?: string }) => void) | null
}
export type RecognizerClass = new () => Recognizer

declare global {
  interface Window {
    SpeechRecognition?: RecognizerClass
    webkitSpeechRecognition?: RecognizerClass
  }
}

// The browser's recognizer, standard or webkit-prefixed; null without one.
export const recognizerClass = (): RecognizerClass | null =>
  window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null

// Speech recognition (standard or webkit-prefixed) and speech synthesis, as this browser has them.
export function speechSupport(): { recognition: boolean; synthesis: boolean } {
  return {
    recognition: recognizerClass() !== null,
    synthesis: 'speechSynthesis' in window && typeof SpeechSynthesisUtterance === 'function',
  }
}
