// decision-notifications 79 (pure part): only a spec or question need makes a notice; a pull
// request ready to merge, after-deploy steps and no need (a finished task) make none.
import { describe, expect, it } from 'vitest'
import { decisionNotice } from '../packages/shared/src/index.ts'
import { deployTask, makeTask, mergeTask, summaryTask } from './fixtures/web-threads-b2.tsx'

describe('decision-notifications 79: nothing to notify', () => {
  it.each([
    ['a pull request ready to merge', mergeTask()],
    ['after-deploy steps', deployTask()],
    ['a finished task', summaryTask()],
    ['a task with no need', makeTask('idle', { stage: 'build', needs: null })],
  ])('returns null for %s', (_name, task) => {
    expect(decisionNotice(task, 'kanban')).toBeNull()
  })
})
