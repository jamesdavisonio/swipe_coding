// Repro for the missing comments index (fix/comments-index). kanban_get_task reads a task's last
// 30 comments with `where('taskId', '==', id).orderBy('createdAt', 'desc')` (Board.getComments),
// which needs a composite index on comments (taskId ASC, createdAt DESC). On 2026-11-05 the live
// board answered it with "9 FAILED_PRECONDITION: The query requires an index": the index had only
// ever been created by hand and was lost when the undeclared indexes were removed. The Firestore
// emulator does not enforce composite indexes, so this guards the declaration that every deploy
// sends; together with the existing ones the queries the agent and the web app run stay covered.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

interface IndexField {
  fieldPath: string
  order?: 'ASCENDING' | 'DESCENDING'
}
interface Index {
  collectionGroup: string
  queryScope: string
  fields: IndexField[]
}

const declared = (
  JSON.parse(readFileSync(new URL('../firestore.indexes.json', import.meta.url), 'utf8')) as {
    indexes: Index[]
  }
).indexes

function hasIndex(collectionGroup: string, fields: IndexField[]): boolean {
  return declared.some(
    (i) =>
      i.collectionGroup === collectionGroup &&
      i.queryScope === 'COLLECTION' &&
      i.fields.length === fields.length &&
      i.fields.every((f, n) => f.fieldPath === fields[n].fieldPath && f.order === fields[n].order)
  )
}

describe('firestore.indexes.json declares the composite indexes the board queries need', () => {
  it('comments by task, newest first (kanban_get_task)', () => {
    expect(
      hasIndex('comments', [
        { fieldPath: 'taskId', order: 'ASCENDING' },
        { fieldPath: 'createdAt', order: 'DESCENDING' },
      ])
    ).toBe(true)
  })

  it.each([
    [
      'comments by task, oldest first (the thread)',
      'comments',
      [
        { fieldPath: 'taskId', order: 'ASCENDING' },
        { fieldPath: 'createdAt', order: 'ASCENDING' },
      ],
    ],
    [
      "an agent's undelivered comments (delivery)",
      'comments',
      [
        { fieldPath: 'agentId', order: 'ASCENDING' },
        { fieldPath: 'deliveredAt', order: 'ASCENDING' },
        { fieldPath: 'createdAt', order: 'ASCENDING' },
      ],
    ],
    [
      "a project's tasks, newest first (kanban_list_tasks, the project page)",
      'tasks',
      [
        { fieldPath: 'projectId', order: 'ASCENDING' },
        { fieldPath: 'updatedAt', order: 'DESCENDING' },
      ],
    ],
    [
      "a project's tasks at one stage (kanban_list_tasks with a stage)",
      'tasks',
      [
        { fieldPath: 'projectId', order: 'ASCENDING' },
        { fieldPath: 'stage', order: 'ASCENDING' },
        { fieldPath: 'updatedAt', order: 'DESCENDING' },
      ],
    ],
    [
      "one operation's log trail (kanban_logs with a request id)",
      'logs',
      [
        { fieldPath: 'request_id', order: 'ASCENDING' },
        { fieldPath: 'ts', order: 'ASCENDING' },
      ],
    ],
  ] as [string, string, IndexField[]][])('still declares %s', (_name, group, fields) => {
    expect(hasIndex(group, fields)).toBe(true)
  })
})
