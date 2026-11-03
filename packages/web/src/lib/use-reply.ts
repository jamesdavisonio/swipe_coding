// The thread's composer state: the text being typed, James's replies that the snapshot does not
// hold yet (shown at once with one tick), and what happens when a write is refused. Each send
// takes a fresh comment id from newCommentId(), so a pending reply is matched to its saved copy
// by id, never by text, and a retried write cannot duplicate it.
import { useEffect, useState } from 'react'
import type { Comment, Task } from '@kanban/shared'
import { newCommentId, sendReply } from '../data.ts'
import { MAX_COMMENT_CHARS } from './limits.ts'
import { jamesComment, mergeMessages, replyKind } from './messages.ts'
import { track } from './use-thread-actions.ts'

export function useReply(task: Task, saved: readonly Comment[]) {
  const [text, setText] = useState('')
  const [pending, setPending] = useState<Comment[]>([])
  const [failed, setFailed] = useState(false)
  const body = text.trim().slice(0, MAX_COMMENT_CHARS)

  // Once the snapshot holds a reply, its pending copy has done its job.
  useEffect(() => {
    const known = new Set(saved.map((c) => c.id))
    setPending((list) =>
      list.some((c) => known.has(c.id)) ? list.filter((c) => !known.has(c.id)) : list
    )
  }, [saved])

  function send() {
    if (body === '') return
    const id = newCommentId()
    setPending((list) => [...list, jamesComment(task, replyKind(task), body, Date.now(), id)])
    setText('')
    setFailed(false)
    void track('reply', task.id, () => sendReply(task, { id, body })).then((ok) => {
      if (ok) return
      // A write refused for good: take the message back, put the text back, say so.
      setPending((list) => list.filter((c) => c.id !== id))
      setText((current) => (current.trim() === '' ? body : `${body}\n${current}`))
      setFailed(true)
    })
  }

  return {
    text,
    setText,
    canSend: body !== '',
    send,
    failed,
    messages: mergeMessages(saved, pending),
  }
}
