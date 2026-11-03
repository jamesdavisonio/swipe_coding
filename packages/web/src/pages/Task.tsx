import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { isAgentOnline, type Comment } from '@kanban/shared'
import {
  addComment,
  approveSpec,
  setTaskStatus,
  useAgent,
  useProject,
  useTask,
  useTaskComments,
} from '../data.ts'
import { legacyStatus, legacySteps, needText, type LegacyStep } from '../lib/legacy-status.ts'
import { AgentDot, Page, StatusPill, timeAgo, TopBar, TypePill } from '../ui.tsx'

export default function TaskPage() {
  const { taskId } = useParams()
  const task = useTask(taskId)
  const project = useProject(task.data?.projectId)
  const agent = useAgent(task.data?.agentId)
  const comments = useTaskComments(taskId)
  const [menu, setMenu] = useState(false)

  const t = task.data
  if (task.loading)
    return (
      <>
        <TopBar title="…" back="/" />
        <Page>Loading…</Page>
      </>
    )
  if (!t)
    return (
      <>
        <TopBar title="Task" back="/" />
        <Page>
          <p className="text-slate-500">Task not found.</p>
        </Page>
      </>
    )

  // Menu items close the menu, then run their action.
  const act = (fn: () => Promise<void>) => {
    setMenu(false)
    void fn()
  }
  const status = legacyStatus(t)
  const steps = legacySteps(t)
  const need = needText(t)
  const agentOnline = agent.data ? isAgentOnline(agent.data) : false
  const resumeCmd = agent.data?.claudeSessionId
    ? `claude --resume ${agent.data.claudeSessionId}`
    : null

  return (
    <>
      <TopBar
        title={project.data?.name ?? ''}
        back={`/p/${t.projectId}`}
        right={
          <div className="relative">
            <button
              className="btn-ghost px-2"
              onClick={() => setMenu((v) => !v)}
              aria-label="Task actions"
            >
              ⋯
            </button>
            {menu && (
              <div role="menu" className="card absolute right-0 top-9 z-30 w-44 p-1 text-sm">
                {status !== 'done' && (
                  <MenuItem onClick={() => act(() => setTaskStatus(t, 'done'))}>Mark done</MenuItem>
                )}
                {status !== 'queued' && (
                  <MenuItem onClick={() => act(() => setTaskStatus(t, 'queued'))}>
                    Re-queue (unbind session)
                  </MenuItem>
                )}
                {status === 'done' && (
                  <MenuItem onClick={() => act(() => setTaskStatus(t, 'in_progress'))}>
                    Reopen
                  </MenuItem>
                )}
              </div>
            )}
          </div>
        }
      />
      <Page>
        <div className="space-y-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <TypePill type={t.type} />
              <StatusPill status={status} />
              <span className="text-xs text-slate-500">updated {timeAgo(t.updatedAt)}</span>
            </div>
            <h1 className="mt-2 text-xl font-semibold leading-tight">{t.title}</h1>
            {t.description && (
              <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">
                {t.description}
              </p>
            )}
          </div>

          <div className="card space-y-2 p-3 text-sm">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <AgentDot agent={agent.data} />
              {resumeCmd && <CopyButton text={resumeCmd} label="copy resume cmd" />}
            </div>
            {t.pr && (
              <div className="flex flex-wrap items-center gap-2">
                <a className="btn-primary py-1.5" href={t.pr.url} target="_blank" rel="noreferrer">
                  Open PR ↗
                </a>
              </div>
            )}
            {need && (
              <div className="rounded-lg bg-amber-50 p-2 text-amber-900 dark:bg-amber-900/30 dark:text-amber-100">
                <div className="text-[11px] font-semibold uppercase tracking-wide">
                  Question for you
                </div>
                <div className="whitespace-pre-wrap">{need}</div>
              </div>
            )}
          </div>

          {steps.length > 0 && (
            <div className="card p-3">
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Steps
              </h2>
              <ol className="space-y-1.5">
                {steps.map((s) => (
                  <li key={s.key} className="flex items-start gap-2 text-sm">
                    <StepDot status={s.status} />
                    <div className="min-w-0 flex-1">
                      <div className={s.status === 'done' ? 'text-slate-500 line-through' : ''}>
                        {s.label}
                      </div>
                    </div>
                    {s.status === 'awaiting_approval' && (
                      <button className="btn-primary py-1" onClick={() => approveSpec(t)}>
                        Approve
                      </button>
                    )}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {t.summary && (
            <div className="card p-3">
              <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Summary
              </h2>
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{t.summary}</p>
            </div>
          )}

          <div>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Thread
            </h2>
            {!agentOnline && status !== 'done' && (
              <p className="mb-2 text-xs text-slate-500">
                No session is online for this task. Your comments are saved and delivered when one
                picks it up.
              </p>
            )}
            <Thread comments={comments.data} />
          </div>
        </div>
      </Page>

      <Composer
        onSend={(body) => addComment(t, body)}
        placeholder={t.needs?.kind === 'question' ? 'Answer…' : 'Comment to the session…'}
      />
    </>
  )
}

function MenuItem({ onClick, children }: { onClick: () => void; children: string }) {
  return (
    <button
      role="menuitem"
      className="block w-full rounded-md px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-800"
      onClick={onClick}
    >
      {children}
    </button>
  )
}

function StepDot({ status }: { status: LegacyStep['status'] }) {
  const cls =
    status === 'done'
      ? 'bg-emerald-500 border-emerald-500'
      : status === 'in_progress'
        ? 'border-sky-500 bg-sky-500/30'
        : status === 'awaiting_approval'
          ? 'border-amber-500 bg-amber-400'
          : 'border-slate-400 bg-transparent'
  return <span className={`mt-1 h-3 w-3 shrink-0 rounded-full border-2 ${cls}`} />
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [ok, setOk] = useState(false)
  return (
    <button
      className="btn-outline py-1 text-xs"
      onClick={async () => {
        await navigator.clipboard.writeText(text)
        setOk(true)
        setTimeout(() => setOk(false), 1500)
      }}
      title={text}
    >
      {ok ? 'copied' : label}
    </button>
  )
}

function Thread({ comments }: { comments: Comment[] }) {
  const endRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [comments.length])

  if (comments.length === 0) return <p className="text-sm text-slate-500">No messages yet.</p>
  return (
    <div className="space-y-2">
      {comments.map((c) => (
        <Bubble key={c.id} c={c} />
      ))}
      <div ref={endRef} />
    </div>
  )
}

function Bubble({ c }: { c: Comment }) {
  if (c.kind === 'system') {
    return (
      <div className="px-2 text-center text-xs text-slate-400">
        {c.body} · {timeAgo(c.createdAt)}
      </div>
    )
  }
  const mine = c.author === 'james'
  const base = 'max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap break-words'
  const cls = mine
    ? 'bg-sky-600 text-white rounded-br-sm'
    : c.kind === 'question'
      ? 'bg-amber-100 text-amber-950 rounded-bl-sm dark:bg-amber-900/50 dark:text-amber-50'
      : 'bg-white border border-slate-200 rounded-bl-sm dark:bg-slate-900 dark:border-slate-800'
  return (
    <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
      <div className="max-w-full">
        <div className={`${base} ${cls}`}>
          {c.kind === 'question' && (
            <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide opacity-70">
              Question
            </div>
          )}
          {c.body}
        </div>
        <div className={`mt-0.5 px-1 text-[10px] text-slate-400 ${mine ? 'text-right' : ''}`}>
          {timeAgo(c.createdAt)}
          {mine && c.deliveredAt == null && (
            <span className="ml-1 text-amber-500">· unread by agent</span>
          )}
          {mine && c.deliveredAt != null && <span className="ml-1">· delivered</span>}
        </div>
      </div>
    </div>
  )
}

function Composer({
  onSend,
  placeholder,
}: {
  onSend: (body: string) => Promise<void>
  placeholder: string
}) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)

  async function send() {
    if (!text.trim() || busy) return
    setBusy(true)
    try {
      await onSend(text)
      setText('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-slate-50/95 backdrop-blur pb-safe dark:border-slate-800 dark:bg-slate-950/95">
      <form
        className="mx-auto flex max-w-5xl items-end gap-2 p-2"
        onSubmit={(e) => {
          e.preventDefault()
          void send()
        }}
      >
        <textarea
          className="input max-h-40 min-h-10 resize-none py-2"
          rows={1}
          placeholder={placeholder}
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            e.target.style.height = 'auto'
            e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void send()
          }}
        />
        <button className="btn-primary h-10" type="submit" disabled={busy || !text.trim()}>
          Send
        </button>
      </form>
    </div>
  )
}
