import { useEffect, useState } from 'react'
import type { Comment, Task } from '@kanban/shared'
import { emptyThreadText, readMoreId } from '../lib/messages.ts'
import { activeNeed } from '../lib/threads.ts'
import { useReply } from '../lib/use-reply.ts'
import { useThreadActions, type SheetMode } from '../lib/use-thread-actions.ts'
import { useUnreadCleared } from '../lib/use-unread-cleared.ts'
import DecisionSheet from './DecisionSheet.tsx'
import HistorySheet from './HistorySheet.tsx'
import MessageList from './MessageList.tsx'
import ThreadFooter from './ThreadFooter.tsx'
import ThreadHeader from './ThreadHeader.tsx'

// Keeps the newest message in view as the conversation grows (the page scrolls; the header and
// footer are sticky): on open, on a new message and when the typing dots come or go.
function useStickToBottom(messageCount: number, working: boolean) {
  useEffect(() => {
    const page = document.scrollingElement
    if (page) page.scrollTop = page.scrollHeight
  }, [messageCount, working])
}

// One loaded thread: header with stepper, the conversation, and the footer (quick replies and
// composer, or the done note). Keyed by task id by the page, so each thread starts fresh.
export default function ThreadView({
  task,
  comments,
  projectName,
  live,
  now,
}: {
  task: Task
  comments: Comment[]
  projectName: string | null
  live: boolean
  now: number
}) {
  const [sheet, setSheet] = useState<SheetMode | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const actions = useThreadActions((_task, mode) => setSheet(mode))
  const reply = useReply(task, comments)
  useUnreadCleared(task)
  useStickToBottom(reply.messages.length, task.working === true)

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-(--content-max) flex-col">
      <ThreadHeader
        task={task}
        projectName={projectName}
        live={live}
        onHistory={() => setHistoryOpen(true)}
      />
      <main className="flex-1 px-4">
        <MessageList
          messages={reply.messages}
          now={now}
          readMoreId={readMoreId(reply.messages, activeNeed(task))}
          working={task.working === true}
          emptyText={emptyThreadText(task, projectName)}
          onReadMore={() => setSheet('read')}
        />
      </main>
      <ThreadFooter
        task={task}
        now={now}
        reply={reply}
        onQuickReply={(quick) => actions.reply(task, quick)}
      />
      {sheet ? <DecisionSheet task={task} mode={sheet} onClose={() => setSheet(null)} /> : null}
      {historyOpen ? <HistorySheet task={task} onClose={() => setHistoryOpen(false)} /> : null}
    </div>
  )
}
