import { useEffect, useState } from 'react'

const DEFAULT_REFRESH_MS = 30_000

// The current time as state, refreshed on an interval, so relative times and "is the session
// still live" stay honest on a screen that nobody touches.
export function useNow(refreshMs = DEFAULT_REFRESH_MS): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), refreshMs)
    return () => clearInterval(id)
  }, [refreshMs])
  return now
}
