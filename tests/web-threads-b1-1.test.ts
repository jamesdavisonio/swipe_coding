// web-threads B1, criterion 1: the fixed stage chain per task type.
import { describe, expect, it } from 'vitest'
import { STAGE_LABEL, stagesFor } from '../packages/shared/src/index.ts'

describe('B1-1 stage list per task type', () => {
  it('feature without after-deploy steps: spec → approved → build → pr → merged → main_ci → done', () => {
    expect(stagesFor('feature', false)).toEqual([
      'spec',
      'approved',
      'build',
      'pr',
      'merged',
      'main_ci',
      'done',
    ])
  })

  it('feature with after-deploy steps puts after_deploy right before done', () => {
    expect(stagesFor('feature', true)).toEqual([
      'spec',
      'approved',
      'build',
      'pr',
      'merged',
      'main_ci',
      'after_deploy',
      'done',
    ])
  })

  it('bugfix starts at fix instead of spec → approved → build', () => {
    expect(stagesFor('bugfix', false)).toEqual(['fix', 'pr', 'merged', 'main_ci', 'done'])
    expect(stagesFor('bugfix', true)).toEqual([
      'fix',
      'pr',
      'merged',
      'main_ci',
      'after_deploy',
      'done',
    ])
  })

  it('chore is do → done, with after_deploy before done when it has steps', () => {
    expect(stagesFor('chore', false)).toEqual(['do', 'done'])
    expect(stagesFor('chore', true)).toEqual(['do', 'after_deploy', 'done'])
  })

  it('for_james has an empty stage list', () => {
    expect(stagesFor('for_james', false)).toEqual([])
    expect(stagesFor('for_james', true)).toEqual([])
  })

  it('every stage has the label James sees', () => {
    expect(STAGE_LABEL).toEqual({
      spec: 'Spec',
      approved: 'Approved',
      build: 'Build',
      fix: 'Fix',
      do: 'Do',
      pr: 'PR',
      merged: 'Merged',
      main_ci: 'Main CI',
      after_deploy: 'After deploy',
      done: 'Done',
    })
  })
})
