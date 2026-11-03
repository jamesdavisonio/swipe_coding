// web-threads B1, shared requirements of the selected new contract: log cap, queued, new task.
import { describe, expect, it } from 'vitest'
import {
  JAMES_COMMENT_KINDS,
  LOG_CAP,
  appendLog,
  initialTaskFields,
  isQueued,
  stageIndex,
} from '../packages/shared/src/index.ts'

const entry = (i: number) => ({ at: i, who: 'session' as const, text: `entry ${i}` })
const entries = (n: number) => Array.from({ length: n }, (_, i) => entry(i))

describe('appendLog', () => {
  it('caps the history at 200 entries', () => {
    expect(LOG_CAP).toBe(200)
  })

  it('under the cap appends in order and archives nothing, leaving the input untouched', () => {
    const before = entries(3)
    const { log, archived } = appendLog(before, entry(3))
    expect(log).toEqual(entries(4))
    expect(archived).toEqual([])
    expect(before).toEqual(entries(3))
  })

  it('reaching exactly 200 archives nothing', () => {
    const { log, archived } = appendLog(entries(199), entry(199))
    expect(log).toEqual(entries(200))
    expect(archived).toEqual([])
  })

  it('a 201st entry archives exactly the oldest one, leaving the input untouched', () => {
    const before = entries(200)
    const { log, archived } = appendLog(before, entry(200))
    expect(archived).toEqual([entry(0)])
    expect(log).toEqual(entries(201).slice(1))
    expect(before).toEqual(entries(200))
  })

  it('an oversized log returns all the overflow, oldest first, keeping the newest 200 in order', () => {
    const before = entries(202)
    const { log, archived } = appendLog(before, entry(202))
    expect(archived).toEqual([entry(0), entry(1), entry(2)])
    expect(log).toEqual(entries(203).slice(3))
    expect(before).toEqual(entries(202))
  })
})

describe('isQueued', () => {
  const feature = { type: 'feature' as const, afterDeploy: [] as string[] }

  it('first stage and no agent → queued, for each type', () => {
    expect(isQueued({ ...feature, stage: 'spec', agentId: null })).toBe(true)
    expect(isQueued({ type: 'bugfix', afterDeploy: [], stage: 'fix', agentId: null })).toBe(true)
    expect(isQueued({ type: 'chore', afterDeploy: [], stage: 'do', agentId: null })).toBe(true)
    expect(isQueued({ type: 'chore', afterDeploy: ['x'], stage: 'do', agentId: null })).toBe(true)
  })

  it('binding an agent un-queues it', () => {
    expect(isQueued({ ...feature, stage: 'spec', agentId: 'agent-1' })).toBe(false)
  })

  it('advancing the stage un-queues it', () => {
    expect(isQueued({ ...feature, stage: 'approved', agentId: null })).toBe(false)
  })

  it("another type's first stage is not queued; for_james is never queued", () => {
    expect(isQueued({ type: 'bugfix', afterDeploy: [], stage: 'spec', agentId: null })).toBe(false)
    expect(isQueued({ type: 'for_james', afterDeploy: [], stage: 'spec', agentId: null })).toBe(
      false
    )
    expect(isQueued({ type: 'for_james', afterDeploy: [], stage: 'do', agentId: null })).toBe(false)
  })

  it('stageIndex follows the stage list and is -1 for a stage not in it', () => {
    expect(stageIndex({ type: 'feature', afterDeploy: ['smoke'], stage: 'after_deploy' })).toBe(6)
    expect(stageIndex({ type: 'feature', afterDeploy: [], stage: 'done' })).toBe(6)
    expect(stageIndex({ type: 'bugfix', afterDeploy: [], stage: 'spec' })).toBe(-1)
    expect(stageIndex({ type: 'feature', afterDeploy: [], stage: 'spec' })).toBe(0)
    expect(stageIndex({ type: 'feature', afterDeploy: [], stage: 'pr' })).toBe(3)
    expect(stageIndex({ type: 'bugfix', afterDeploy: [], stage: 'merged' })).toBe(2)
    expect(stageIndex({ type: 'feature', afterDeploy: ['smoke'], stage: 'done' })).toBe(7)
  })
})

describe('initialTaskFields', () => {
  const base = {
    projectId: 'p1',
    title: 'T',
    description: 'D',
    createdBy: 'james' as const,
    now: 1_800_000_000_000,
  }

  it('a new feature task is exactly the contract shape: stage spec, every new field empty', () => {
    const t = initialTaskFields({
      ...base,
      type: 'feature',
      afterDeploy: ['Run smoke', 'Tell ops'],
    })
    expect(Object.keys(t).sort()).toEqual(
      [
        'projectId',
        'agentId',
        'type',
        'title',
        'description',
        'stage',
        'needs',
        'spec',
        'afterDeploy',
        'afterDone',
        'pr',
        'summary',
        'createdBy',
        'createdAt',
        'updatedAt',
        'doneAt',
        'reopenedAt',
        'unread',
        'working',
        'lastCommentAt',
        'log',
      ].sort()
    )
    expect(t).toStrictEqual({
      projectId: 'p1',
      type: 'feature',
      title: 'T',
      description: 'D',
      createdBy: 'james',
      stage: 'spec',
      needs: null,
      spec: null,
      afterDeploy: ['Run smoke', 'Tell ops'],
      afterDone: [false, false],
      pr: null,
      doneAt: null,
      reopenedAt: null,
      unread: false,
      working: false,
      log: [],
      summary: '',
      agentId: null,
      lastCommentAt: null,
      createdAt: base.now,
      updatedAt: base.now,
    })
  })

  it('echoes its inputs into the task', () => {
    const t = initialTaskFields({
      projectId: 'p2',
      title: 'Other',
      description: 'Desc 2',
      now: 1_700_000_000_123,
      type: 'bugfix',
      createdBy: 'james',
      afterDeploy: [],
    })
    expect([t.projectId, t.title, t.description, t.createdAt, t.updatedAt]).toEqual([
      'p2',
      'Other',
      'Desc 2',
      1_700_000_000_123,
      1_700_000_000_123,
    ])
  })

  it('records who created the task', () => {
    const t = initialTaskFields({
      ...base,
      createdBy: 'agent',
      type: 'feature',
      afterDeploy: ['Run smoke', 'Tell ops'],
    })
    expect(t.createdBy).toBe('agent')
  })

  it('starts bugfix at fix and chore at do, with no after-deploy flags', () => {
    const bug = initialTaskFields({ ...base, type: 'bugfix', afterDeploy: [] })
    expect([bug.stage, bug.afterDone]).toEqual(['fix', []])
    expect(initialTaskFields({ ...base, type: 'chore', afterDeploy: [] }).stage).toBe('do')
  })
})

it('James comment kinds are exactly the six he can send', () => {
  expect([...JAMES_COMMENT_KINDS].sort()).toEqual(
    ['answer', 'approve', 'change_request', 'comment', 'merged', 'reopen'].sort()
  )
})
