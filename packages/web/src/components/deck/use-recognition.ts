// The microphone: the browser's speech recognition (standard or webkit-prefixed), the words shown
// as they come (interim results), stopped and restarted by James. A refused microphone falls back
// to the text box, like a browser without recognition.
import { useCallback, useEffect, useRef, useState } from 'react'
import { recognizerClass, type RecognitionEvent, type Recognizer } from '../../lib/speech.ts'

// Notes go to sessions in English.
const RECOGNITION_LANG = 'en-GB'
// Errors that mean the microphone will not work here: type instead.
const NO_MICROPHONE = ['not-allowed', 'service-not-allowed', 'audio-capture']

// Everything heard in this run: the final words, then the words still being guessed.
function heard(e: RecognitionEvent): string {
  let final = ''
  let interim = ''
  for (let i = 0; i < e.results.length; i++) {
    const result = e.results[i]
    if (result.isFinal) final += result[0].transcript
    else interim += result[0].transcript
  }
  return `${final}${interim}`
}

export function useRecognition() {
  const recognizer = useRef<Recognizer | null>(null)
  const said = useRef('')
  const [text, setText] = useState('')
  const [listening, setListening] = useState(false)
  const [refused, setRefused] = useState(false)

  const show = useCallback((words: string) => {
    said.current = words
    setText(words)
  }, [])

  const start = useCallback(() => {
    const Recognition = recognizerClass()
    if (!Recognition || recognizer.current) return
    const r = new Recognition()
    r.continuous = true
    r.interimResults = true
    r.lang = RECOGNITION_LANG
    // A second run (after a pause) adds to what was already said.
    const before = said.current === '' ? '' : `${said.current} `
    r.onresult = (e) => show(`${before}${heard(e)}`.trim())
    r.onerror = (e) => {
      if (NO_MICROPHONE.includes(e.error ?? '')) setRefused(true)
    }
    r.onend = () => {
      recognizer.current = null
      setListening(false)
    }
    recognizer.current = r
    setListening(true)
    r.start()
  }, [show])

  const stop = useCallback(() => recognizer.current?.stop(), [])

  // Closing the sheet throws away what was heard.
  const reset = useCallback(() => {
    const r = recognizer.current
    recognizer.current = null
    if (r) {
      r.onend = null
      r.onresult = null
      r.abort()
    }
    setListening(false)
    show('')
    setRefused(false)
  }, [show])

  useEffect(() => () => recognizer.current?.abort(), [])

  return { text, listening, refused, start, stop, reset }
}

export type Recognition = ReturnType<typeof useRecognition>
