// Radix only knows how to hand focus back to a Dialog.Trigger; our sheets are opened by chips and
// buttons elsewhere, so the control that had focus when the sheet mounted gets it back. Pass the
// result to the sheet content's `onCloseAutoFocus`.
import { useCallback, useState } from 'react'
import { flushSync } from 'react-dom'
import { rememberFocus } from './a11y.ts'

export function useReturnFocus(): (event: Event) => void {
  const [restoreFocus] = useState(rememberFocus)
  return useCallback(
    (event: Event) => {
      event.preventDefault()
      restoreFocus()
    },
    [restoreFocus]
  )
}

// Closes an overlay now and hands focus to its opener at once. Radix moves focus a tick after its
// focus trap unmounts, so until then a screen reader (or the next key press) would land on the
// page's body; and while the trap is still mounted it pulls focus back in, so the close commits
// first.
export function closeAndFocus(close: () => void, focus: () => void) {
  flushSync(close)
  focus()
}
