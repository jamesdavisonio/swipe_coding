// The New session sheet's idea box: what James typed, and what he dictates after it, with the
// deck's microphone (use-recognition.ts, the voice note's recognition: no repeated phrases, it
// listens until stopped). Each dictation appends to the text as it was when he tapped Dictate;
// typing takes the box over (and ends a dictation still listening).
import { useState } from 'react'
import { useRecognition } from './use-recognition.ts'

// Dictated words follow the text before them after one space.
const appendWords = (before: string, words: string) =>
  [before.trimEnd(), words].filter((s) => s !== '').join(' ')

export function useIdea() {
  const voice = useRecognition()
  const [typed, setTyped] = useState('')
  // The text before the current dictation; null once James types.
  const [before, setBefore] = useState<string | null>(null)
  const text = before === null ? typed : appendWords(before, voice.text)

  function type(next: string) {
    if (voice.listening) voice.stop()
    setTyped(next)
    setBefore(null)
  }
  function dictate() {
    setBefore(text)
    voice.reset()
    voice.start()
  }

  return {
    text,
    type,
    dictate,
    stop: voice.stop,
    listening: voice.listening,
    refused: voice.refused,
  }
}

export type IdeaModel = ReturnType<typeof useIdea>
