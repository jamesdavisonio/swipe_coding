import { Check, Copy } from '../lib/icons.ts'
import { useCopy } from '../lib/use-copy.ts'
import { Button } from './ui/button.tsx'

// "You could start next": the suggestions a finished session left, one Copy button each. Copy
// only puts the text on the clipboard; starting a session is James's to do.
export default function SuggestedNext({ items, taskId }: { items: string[]; taskId: string }) {
  const { copied, copy } = useCopy(taskId)
  if (items.length === 0) return null
  return (
    <div className="mt-3 flex flex-col gap-1.5">
      <h4 className="text-xs font-bold text-muted-foreground">You could start next</h4>
      <ul className="flex flex-col gap-2">
        {items.map((item, index) => {
          const done = copied === index
          return (
            <li key={`${index}:${item}`} className="flex items-center gap-2">
              <span className="min-w-0 flex-1 text-base leading-snug">{item}</span>
              <Button
                variant="outline"
                className="px-3 text-sm"
                aria-label={`${done ? 'Copied' : 'Copy'}: ${item}`}
                onClick={() => copy(index, item)}
              >
                {done ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
                {done ? 'Copied' : 'Copy'}
              </Button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
