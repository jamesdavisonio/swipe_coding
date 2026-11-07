// One short message at a time above the dock ("Sent to …"), gone after a moment.
import { useCallback, useEffect, useRef, useState } from 'react'

const TOAST_MS = 2400

export function useToast() {
  const [message, setMessage] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const show = useCallback((text: string) => {
    clearTimeout(timer.current)
    setMessage(text)
    timer.current = setTimeout(() => setMessage(null), TOAST_MS)
  }, [])
  useEffect(() => () => clearTimeout(timer.current), [])
  return { message, show }
}
