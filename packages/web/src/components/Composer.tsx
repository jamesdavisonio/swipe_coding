import { useId, type KeyboardEvent } from 'react'
import { MAX_COMMENT_CHARS } from '../lib/limits.ts'
import { Send } from '../lib/icons.ts'
import { Button } from './ui/button.tsx'
import { Textarea } from './ui/input.tsx'

// The reply box. Enter is a newline (phone keyboards); Ctrl+Enter or ⌘+Enter sends, as does
// the Send button, which stays disabled while the trimmed text is empty. A refused write puts
// the text back and says so inline.
export default function Composer({
  text,
  onText,
  canSend,
  onSend,
  failed,
}: {
  text: string
  onText: (text: string) => void
  canSend: boolean
  onSend: () => void
  failed: boolean
}) {
  const errorId = useId()
  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault()
      onSend()
    }
  }
  return (
    <form
      className="flex flex-col gap-1.5"
      onSubmit={(event) => {
        event.preventDefault()
        onSend()
      }}
    >
      {failed ? (
        <p id={errorId} role="alert" className="px-1 text-sm font-semibold text-needs">
          Couldn't send. Try again.
        </p>
      ) : null}
      <div className="flex items-end gap-2">
        <Textarea
          aria-label="Message to the session"
          aria-invalid={failed || undefined}
          aria-describedby={failed ? errorId : undefined}
          placeholder="Message the session…"
          rows={1}
          maxLength={MAX_COMMENT_CHARS}
          value={text}
          onChange={(event) => onText(event.target.value)}
          onKeyDown={onKeyDown}
          className="max-h-40 min-h-11 flex-1 resize-none rounded-xl [field-sizing:content]"
        />
        <Button type="submit" variant="accent" size="icon" aria-label="Send" disabled={!canSend}>
          <Send aria-hidden="true" />
        </Button>
      </div>
    </form>
  )
}
