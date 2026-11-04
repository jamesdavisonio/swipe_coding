// Radix only knows how to hand focus back to a Dialog.Trigger; our sheets are opened by chips and
// buttons elsewhere, so the control that had focus when the sheet mounted gets it back. Pass the
// result to the sheet content's `onCloseAutoFocus`.
import { useCallback, useState } from 'react'
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
