// The microphone: the browser's speech recognition (standard or webkit-prefixed), the words shown
// as they come (interim results). It listens until James stops it, 15 s pass with no new words,
// or 3 minutes pass; a run the browser ends by itself (Android, after a pause) starts again. A
// refused microphone falls back to the text box, like a browser without recognition.
import { useCallback, useEffect, useRef, useState } from 'react'
import { recognizerClass, type RecognitionEvent, type Recognizer } from '../../lib/speech.ts'

// Listening stops after this long without a result event…
export const SILENCE_MS = 15_000
// …and this long after James started it (Workshop's decision 0002).
export const MAX_LISTEN_MS = 180_000
// A self-ended run starts again after this short pause, so a failing browser cannot spin.
const RESTART_MS = 250
// Notes go to sessions in English.
const RECOGNITION_LANG = 'en-GB'
// Errors that mean the microphone will not work here: type instead.
const NO_MICROPHONE = ['not-allowed', 'service-not-allowed', 'audio-capture']
type Timer = ReturnType<typeof setTimeout>

// The words of one run. Android repeats the whole stretch heard so far in each result ("I'll
// merge", "I'll merge your"): a result that extends the one before it replaces it. Desktop sends
// separate segments ("I merged it", " myself"), joined in order.
function heard(e: RecognitionEvent): string {
  const parts: string[] = []
  for (let i = 0; i < e.results.length; i++) {
    const words = e.results[i][0].transcript
    const last = parts.length - 1
    if (last >= 0 && words.trim().startsWith(parts[last].trim())) parts[last] = words
    else parts.push(words)
  }
  return parts.join('').trim()
}

export function useRecognition() {
  const recognizer = useRef<Recognizer | null>(null)
  // Whether James wants it listening: false once he, the silence or the cap stopped it.
  const active = useRef(false)
  const silence = useRef<Timer>(undefined)
  const cap = useRef<Timer>(undefined)
  const restart = useRef<Timer>(undefined)
  const said = useRef('')
  const [text, setText] = useState('')
  const [listening, setListening] = useState(false)
  const [refused, setRefused] = useState(false)

  const show = useCallback((words: string) => {
    said.current = words
    setText(words)
  }, [])

  // No longer wanted, nothing pending: no restart, no silence or cap timer.
  const quiet = useCallback(() => {
    active.current = false
    for (const timer of [silence, cap, restart]) clearTimeout(timer.current)
  }, [])

  // Stopped (by James, the silence or the cap): the words stay, nothing restarts.
  const stop = useCallback(() => {
    quiet()
    setListening(false)
    recognizer.current?.stop()
  }, [quiet])

  const armSilence = useCallback(() => {
    clearTimeout(silence.current)
    silence.current = setTimeout(stop, SILENCE_MS)
  }, [stop])

  // One recognition run; what was said before it stays, and its words follow after one space.
  const run = useCallback(() => {
    const Recognition = recognizerClass()
    if (!Recognition) return
    const r = new Recognition()
    r.continuous = true
    r.interimResults = true
    r.lang = RECOGNITION_LANG
    const before = said.current
    r.onresult = (e) => {
      show([before, heard(e)].filter((s) => s !== '').join(' '))
      if (active.current) armSilence()
    }
    r.onerror = (e) => {
      if (!NO_MICROPHONE.includes(e.error ?? '')) return
      quiet()
      setRefused(true)
    }
    r.onend = () => {
      if (recognizer.current !== r) return
      recognizer.current = null
      if (active.current) restart.current = setTimeout(run, RESTART_MS)
      else setListening(false)
    }
    recognizer.current = r
    r.start()
  }, [show, armSilence, quiet])

  const start = useCallback(() => {
    if (!recognizerClass() || active.current || recognizer.current) return
    active.current = true
    cap.current = setTimeout(stop, MAX_LISTEN_MS)
    armSilence()
    setListening(true)
    run()
  }, [stop, armSilence, run])

  // Ends everything without a trace: no handlers, no timers, the run aborted.
  const shutdown = useCallback(() => {
    quiet()
    const r = recognizer.current
    recognizer.current = null
    if (!r) return
    r.onend = null
    r.onresult = null
    r.onerror = null
    r.abort()
  }, [quiet])

  // Closing the sheet throws away what was heard.
  const reset = useCallback(() => {
    shutdown()
    setListening(false)
    show('')
    setRefused(false)
  }, [shutdown, show])

  useEffect(() => shutdown, [shutdown])

  return { text, listening, refused, start, stop, reset }
}

export type Recognition = ReturnType<typeof useRecognition>
