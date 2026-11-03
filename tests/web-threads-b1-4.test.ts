// web-threads B1, criterion 4: firestore.indexes.json checks only. The Firestore rules
// behaviour for criterion 4 lives in the emulator test tests/rules/web-threads-b1-4.rules.test.ts
// (`npm run test:rules`).
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = join(import.meta.dirname, '..')

interface Index {
  collectionGroup: string
  queryScope: string
  fields: { fieldPath: string; order?: string }[]
}
const { indexes } = JSON.parse(readFileSync(join(root, 'firestore.indexes.json'), 'utf8')) as {
  indexes: Index[]
}
const shape = (i: Index) =>
  `${i.collectionGroup}[${i.queryScope}](${i.fields.map((f) => `${f.fieldPath} ${f.order}`).join(', ')})`

describe('B1-4 firestore.indexes.json', () => {
  it('has the stage and doneAt task indexes', () => {
    const all = indexes.map(shape)
    expect(all).toContain(
      'tasks[COLLECTION](projectId ASCENDING, stage ASCENDING, updatedAt DESCENDING)'
    )
    expect(all).toContain('tasks[COLLECTION](projectId ASCENDING, doneAt DESCENDING)')
  })

  it('keeps both comments indexes unchanged', () => {
    const all = indexes.map(shape)
    expect(all).toContain('comments[COLLECTION](taskId ASCENDING, createdAt ASCENDING)')
    expect(all).toContain(
      'comments[COLLECTION](agentId ASCENDING, deliveredAt ASCENDING, createdAt ASCENDING)'
    )
  })

  it('no longer indexes status', () => {
    expect(
      indexes.filter((i) => i.fields.some((f) => f.fieldPath === 'status')).map(shape)
    ).toEqual([])
  })
})
