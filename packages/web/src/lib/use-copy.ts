// Copying a suggestion to the clipboard: logs the tap, writes the text, and remembers which
// suggestion was just copied so its button can say "Copied" for a moment before it reads "Copy" again.
import { useEffect, useRef, useState } from 'react'
import { track } from './use-thread-actions.ts'

// How long a button keeps saying "Copied".
export const COPIED_MS = 2_000

export function useCopy(taskId: string) {
  const [copied, setCopied] = useState<number | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => () => clearTimeout(timer.current), [])

  function copy(index: number, item: string) {
    void track(
      'copy_suggestion',
      taskId,
      () => navigator.clipboard.writeText(item),
      () => {
        clearTimeout(timer.current)
        setCopied(index)
        timer.current = setTimeout(() => setCopied(null), COPIED_MS)
      }
    )
  }

  return { copied, copy }
}
