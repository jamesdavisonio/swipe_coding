import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import DecisionSheet from '../components/DecisionSheet.tsx'
import { ALL_PROJECTS } from '../components/ProjectChips.tsx'
import ThreadList from '../components/ThreadList.tsx'
import Screen from '../components/Screen.tsx'
import { ForJamesRow, TaskRow } from '../components/ThreadRow.tsx'
import ThreadsHeader from '../components/ThreadsHeader.tsx'
import type { ThreadRow } from '../lib/threads.ts'
import { track, useThreadActions, type SheetMode } from '../lib/use-thread-actions.ts'
import { useThreadsBoard } from '../lib/use-threads-board.ts'

const PROJECT_PARAM = 'project'

type Board = ReturnType<typeof useThreadsBoard>
type Actions = ReturnType<typeof useThreadActions>

function rowView(row: ThreadRow, board: Board, actions: Actions) {
  if (row.kind === 'for_james')
    return (
      <ForJamesRow
        key={`for_james:${row.projectId}`}
        projectId={row.projectId}
        projectName={board.nameOf.get(row.projectId) ?? row.projectId}
        todos={row.todos}
        at={row.at}
        now={board.now}
        onOpen={actions.openForJames}
      />
    )
  return (
    <TaskRow
      key={row.task.id}
      task={row.task}
      projectName={board.nameOf.get(row.task.projectId) ?? row.task.projectId}
      live={board.liveProjects.has(row.task.projectId)}
      now={board.now}
      onOpen={actions.openThread}
      onReply={actions.reply}
    />
  )
}

export default function Threads() {
  const [params, setParams] = useSearchParams()
  const filter = params.get(PROJECT_PARAM) ?? ALL_PROJECTS
  const board = useThreadsBoard(filter)
  const [sheet, setSheet] = useState<{ taskId: string; mode: SheetMode } | null>(null)
  const actions = useThreadActions((task, mode) => setSheet({ taskId: task.id, mode }))
  const sheetTask = sheet ? board.tasks.data.find((t) => t.id === sheet.taskId) : undefined
  const waiting = board.countFor(filter)

  function selectProject(projectId: string) {
    const next = new URLSearchParams(params)
    if (projectId === ALL_PROJECTS) next.delete(PROJECT_PARAM)
    else next.set(PROJECT_PARAM, projectId)
    // Replace, so Back from a thread lands on Threads once with the same filter.
    setParams(next, { replace: true })
    void track('filter', projectId)
  }

  return (
    <Screen
      header={
        <ThreadsHeader
          waiting={waiting}
          projects={board.projects.data}
          filter={filter}
          countFor={board.countFor}
          onSelect={selectProject}
        />
      }
    >
      <ThreadList
        loading={board.loading}
        failed={board.failed}
        rows={board.rows}
        render={(row) => rowView(row, board, actions)}
      />
      {sheet && sheetTask ? (
        <DecisionSheet task={sheetTask} mode={sheet.mode} onClose={() => setSheet(null)} />
      ) : null}
    </Screen>
  )
}
