import { useId, useState } from 'react'
import type { Task, TaskNeed } from '@kanban/shared'
import { answerQuestion } from '../data.ts'
import { MAX_COMMENT_CHARS } from '../lib/limits.ts'
import { questionOptions } from '../lib/threads.ts'
import { useDecision } from '../lib/use-decision.ts'
import SaveError from './SaveError.tsx'
import { Button } from './ui/button.tsx'
import { Textarea } from './ui/input.tsx'
import { Label } from './ui/label.tsx'
import { SheetContent } from './ui/sheet.tsx'

// The question decision: one button per option the session offered, plus James's own words.
export default function QuestionDecision({
  task,
  need,
  close,
  returnFocus,
}: {
  task: Task
  need: TaskNeed
  close: () => void
  returnFocus: (event: Event) => void
}) {
  const [text, setText] = useState('')
  const { pending, failed, decide } = useDecision(task.id, close)
  const boxId = useId()

  return (
    <SheetContent
      onCloseAutoFocus={returnFocus}
      title={need.question || 'Question'}
      aria-describedby={undefined}
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          {questionOptions(need).map((option) => (
            <Button
              key={option.key}
              variant="outline"
              className="h-auto min-h-11 justify-start py-2.5 text-left whitespace-normal"
              disabled={pending}
              onClick={() => void decide('answer', () => answerQuestion(task, option))}
            >
              {option.key} · {option.label}
            </Button>
          ))}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={boxId}>Or answer in your words</Label>
          <Textarea
            id={boxId}
            rows={3}
            maxLength={MAX_COMMENT_CHARS}
            placeholder="Type an answer"
            value={text}
            onChange={(event) => setText(event.target.value)}
          />
        </div>
        <SaveError failed={failed} />
        <Button
          disabled={pending || text.trim() === ''}
          onClick={() => void decide('answer', () => answerQuestion(task, { label: text }))}
        >
          Send answer
        </Button>
      </div>
    </SheetContent>
  )
}
