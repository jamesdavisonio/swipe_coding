// Accessibility helpers for overlays we build ourselves. Radix primitives (Sheet/Dialog)
// already trap and restore focus; use these only for a custom overlay or menu.

export const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), ' +
  'textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function focusables(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => !el.hasAttribute('aria-hidden') && el.offsetParent !== null
  )
}

// Keep Tab / Shift+Tab inside `root` while it is open. Returns the cleanup; call it on close.
export function trapFocus(root: HTMLElement): () => void {
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'Tab') return
    const items = focusables(root)
    if (items.length === 0) return
    const first = items[0]
    const last = items[items.length - 1]
    const active = document.activeElement
    if (e.shiftKey && (active === first || !root.contains(active))) {
      e.preventDefault()
      last?.focus()
    } else if (!e.shiftKey && active === last) {
      e.preventDefault()
      first?.focus()
    }
  }
  root.addEventListener('keydown', onKeyDown)
  return () => root.removeEventListener('keydown', onKeyDown)
}

// Remember what had focus before an overlay opened, and put it back afterwards.
export function rememberFocus(): () => void {
  const previous = document.activeElement
  return () => {
    if (previous instanceof HTMLElement) previous.focus()
  }
}

// Tailwind's visually-hidden class, for text that only assistive tech should read.
export const srOnly = 'sr-only'
