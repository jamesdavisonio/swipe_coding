// A tapped decision notification with the board already open: the service worker (public/sw.js)
// focuses this tab and posts { type: 'kanban:open-task', taskId }, and the board opens the deck
// with that task's card first (/?task=<id>). The message is checked before it is used.
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { z } from 'zod'

export const OPEN_TASK_MESSAGE = 'kanban:open-task'
const OpenTask = z.object({ type: z.literal(OPEN_TASK_MESSAGE), taskId: z.string().min(1) })

export function useOpenTaskMessages(): void {
  const navigate = useNavigate()
  useEffect(() => {
    const worker = typeof navigator === 'undefined' ? undefined : navigator.serviceWorker
    if (!worker) return
    const onMessage = (event: MessageEvent) => {
      const message = OpenTask.safeParse(event.data)
      if (message.success) void navigate(`/?task=${encodeURIComponent(message.data.taskId)}`)
    }
    worker.addEventListener('message', onMessage)
    return () => worker.removeEventListener('message', onMessage)
  }, [navigate])
}

// Mounted once inside the router by the app shell.
export function OpenTaskMessages(): null {
  useOpenTaskMessages()
  return null
}
