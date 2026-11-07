// The speaker: the card read aloud with the browser's speech synthesis, in a British English
// voice when the phone has one, with how far it has read so the sheet can show it.
import { useCallback, useEffect, useRef, useState } from 'react'
import { speechSupport } from '../../lib/speech.ts'

const VOICE_FIRST = /en[-_]GB/i
const VOICE_ANY_ENGLISH = /^en/i
const SPEAKING_RATE = 1.02

export interface Reading {
  text: string
  at: number // characters already read
}

function pickVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices()
  return (
    voices.find((v) => VOICE_FIRST.test(v.lang)) ??
    voices.find((v) => VOICE_ANY_ENGLISH.test(v.lang)) ??
    null
  )
}

export function useListen() {
  const [supported] = useState(() => speechSupport().synthesis)
  const [reading, setReading] = useState<Reading | null>(null)
  // The utterance being read; events from one that was cancelled (or replaced) are ignored, so a
  // late `end` from the last reading cannot close the next one.
  const current = useRef<SpeechSynthesisUtterance | null>(null)

  const stop = useCallback(() => {
    current.current = null
    if ('speechSynthesis' in window) window.speechSynthesis.cancel()
    setReading(null)
  }, [])

  const read = useCallback((text: string) => {
    const synth = window.speechSynthesis
    current.current = null
    synth.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    const voice = pickVoice()
    if (voice) utterance.voice = voice
    utterance.rate = SPEAKING_RATE
    utterance.onboundary = (e) => {
      if (current.current === utterance) setReading((r) => (r ? { ...r, at: e.charIndex } : r))
    }
    utterance.onend = () => {
      if (current.current !== utterance) return
      current.current = null
      setReading(null)
    }
    current.current = utterance
    synth.speak(utterance)
    setReading({ text, at: 0 })
  }, [])

  // Leaving the deck stops the voice.
  useEffect(
    () => () => {
      if ('speechSynthesis' in window) window.speechSynthesis.cancel()
    },
    []
  )

  return { supported, reading, read, stop }
}

export type Listen = ReturnType<typeof useListen>
