import { useEffect, useState } from 'react'
import { isDone, type Comment, type Task } from '@kanban/shared'
import { readMoreId } from '../lib/messages.ts'
import { activeNeed, quickReplies } from '../lib/threads.ts'
import { useReply } from '../lib/use-reply.ts'
import { useThreadActions, type SheetMode } from '../lib/use-thread-actions.ts'
import { useUnreadCleared } from '../lib/use-unread-cleared.ts'
import Composer from './Composer.tsx'
import DecisionSheet from './DecisionSheet.tsx'
import HistorySheet from './HistorySheet.tsx'
import MessageList from './MessageList.tsx'
import QuickReplies from './QuickReplies.tsx'
import ThreadFooter, { DoneNote } from './ThreadFooter.tsx'
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
          onReadMore={() => setSheet('read')}
        />
      </main>
      <ThreadFooter>
        <QuickReplies
          replies={quickReplies(task)}
          onReply={(quick) => actions.reply(task, quick)}
          className="pt-0 pl-0"
        />
        {isDone(task) ? (
          <DoneNote task={task} now={now} />
        ) : (
          <Composer
            text={reply.text}
            onText={reply.setText}
            canSend={reply.canSend}
            onSend={reply.send}
            failed={reply.failed}
          />
        )}
      </ThreadFooter>
      {sheet ? <DecisionSheet task={task} mode={sheet} onClose={() => setSheet(null)} /> : null}
      {historyOpen ? <HistorySheet task={task} onClose={() => setHistoryOpen(false)} /> : null}
    </div>
  )
}
