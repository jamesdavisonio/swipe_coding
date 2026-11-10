// The microphone: the browser's speech recognition (standard or webkit-prefixed), the words shown
// as they come (interim results). The words are in two parts: the text from before the current
// listening (typed or edited, or heard earlier) and the words heard since the microphone was last
// tapped. It listens until James stops it, 15 s pass with no new words,
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

// Words follow the words before them after one space.
const joinWords = (before: string, words: string) =>
  words === '' ? before : [before.trimEnd(), words].filter((s) => s !== '').join(' ')

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
  // The part before the current listening, and the words heard in it, across restarts.
  const earlier = useRef('')
  const said = useRef('')
  const [before, setBefore] = useState('')
  const [heardNow, setHeardNow] = useState('')
  const [listening, setListening] = useState(false)
  const [refused, setRefused] = useState(false)

  const showHeard = useCallback((words: string) => {
    said.current = words
    setHeardNow(words)
  }, [])

  // The text before the next listening: typed, edited or cleared, or what was heard.
  const setEarlier = useCallback((words: string) => {
    earlier.current = words
    setBefore(words)
  }, [])

  // What was heard joins the text before it, and the next listening starts with nothing heard.
  const commit = useCallback(() => {
    setEarlier(joinWords(earlier.current, said.current))
    showHeard('')
  }, [setEarlier, showHeard])

  // No longer wanted, nothing pending: no restart, no silence or cap timer.
  const quiet = useCallback(() => {
    active.current = false
    for (const timer of [silence, cap, restart]) clearTimeout(timer.current)
  }, [])

  // Lets go of the current run: its handlers are detached, so a late result or end cannot touch
  // the words, and a new run may start at once. Returns the run, which ends on its own.
  const release = useCallback(() => {
    const r = recognizer.current
    recognizer.current = null
    if (r) {
      r.onend = null
      r.onresult = null
      r.onerror = null
    }
    return r
  }, [])

  // Stopped (by James, the silence or the cap): the words stay, nothing restarts.
  const stop = useCallback(() => {
    quiet()
    commit()
    setListening(false)
    release()?.stop()
  }, [quiet, commit, release])

  const armSilence = useCallback(() => {
    clearTimeout(silence.current)
    silence.current = setTimeout(stop, SILENCE_MS)
  }, [stop])

  // One recognition run; what was heard before it in this listening stays, and its words follow.
  const run = useCallback(() => {
    const Recognition = recognizerClass()
    if (!Recognition) return
    const r = new Recognition()
    r.continuous = true
    r.interimResults = true
    r.lang = RECOGNITION_LANG
    const base = said.current
    r.onresult = (e) => {
      showHeard(joinWords(base, heard(e)))
      if (active.current) armSilence()
    }
    r.onerror = (e) => {
      if (!NO_MICROPHONE.includes(e.error ?? '')) return
      quiet()
      commit()
      release()
      setListening(false)
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
  }, [showHeard, armSilence, quiet, commit, release])

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
    release()?.abort()
  }, [quiet, release])

  // Closing the sheet throws away what was heard.
  const reset = useCallback(() => {
    shutdown()
    setListening(false)
    showHeard('')
    setEarlier('')
    setRefused(false)
  }, [shutdown, showHeard, setEarlier])

  useEffect(() => shutdown, [shutdown])

  const text = joinWords(before, heardNow)
  return { text, before, heardNow, listening, refused, start, stop, reset, edit: setEarlier }
}

export type Recognition = ReturnType<typeof useRecognition>
