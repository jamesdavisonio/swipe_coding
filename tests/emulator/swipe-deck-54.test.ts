// swipe-deck 54, data side, in the Firestore emulator (`npm run test:rules`): sendNote, the write
// behind a voice or typed note. By the task's need: spec is a change request, a question is the
// answer, a PR need is a comment that clears the need, anything else is a comment that leaves the
// need alone. Text is trimmed; blank writes nothing.
import { describe, expect, it, vi } from 'vitest'
import * as data from '../../packages/web/src/data.ts'
import {
  expectUntouched,
  lastEntry,
  makeTask,
  readComments,
  readTask,
  seedTask,
  useEmulator,
} from '../fixtures/web-threads-b4-emulator.ts'

vi.mock('../../packages/web/src/firebase.ts', async () =>
  (await import('../fixtures/web-threads-b4-emulator.ts')).firebaseModule()
)
vi.mock('../../packages/web/src/lib/log.ts', async () =>
  (await import('../fixtures/web-threads-b4-emulator.ts')).logModule()
)

const SPEC = { goal: 'g', points: [], out: '', touches: '', version: 2 }

describe('swipe-deck 54: sendNote in the emulator', () => {
  useEmulator()

  it('a spec note is a change request, same as requestChange', async () => {
    const task = await seedTask(
      makeTask('t1', { stage: 'spec', needs: { kind: 'spec' }, spec: SPEC })
    )
    await data.sendNote(task, '  make it blue  ')
    const stored = await readTask('t1')
    expect(stored.needs).toBeNull()
    expect(stored.stage).toBe('spec')
    expect(lastEntry(stored)?.text).toBe('Asked for a change to spec v2: make it blue')
    const [comment] = await readComments('t1')
    expect(comment).toEqual(
      expect.objectContaining({
        author: 'james',
        kind: 'change_request',
        body: 'Change: make it blue',
      })
    )
  })

  it('a question note is the answer, same as answerQuestion with its words as the label', async () => {
    const task = await seedTask(
      makeTask('t1', { stage: 'build', needs: { kind: 'question', question: 'Which colour?' } })
    )
    await data.sendNote(task, 'green please')
    const stored = await readTask('t1')
    expect(stored.needs).toBeNull()
    expect(lastEntry(stored)?.text).toBe('Answered Which colour?: green please')
    const [comment] = await readComments('t1')
    expect(comment).toEqual(
      expect.objectContaining({ author: 'james', kind: 'answer', body: 'green please' })
    )
  })

  it('a merge note is a plain comment, clears the need and keeps stage pr', async () => {
    const task = await seedTask(
      makeTask('t1', {
        stage: 'pr',
        needs: { kind: 'pr' },
        pr: { number: 24, url: 'https://github.com/x/y/pull/24' },
      })
    )
    await data.sendNote(task, 'rename the button first')
    const stored = await readTask('t1')
    expect(stored.needs).toBeNull()
    expect(stored.stage).toBe('pr')
    const [comment] = await readComments('t1')
    expect(comment).toEqual(
      expect.objectContaining({ author: 'james', kind: 'comment', body: 'rename the button first' })
    )
  })

  it('a second merge note with the same stale task writes nothing more', async () => {
    const task = await seedTask(
      makeTask('t1', {
        stage: 'pr',
        needs: { kind: 'pr' },
        pr: { number: 24, url: 'https://x/pull/24' },
      })
    )
    await data.sendNote(task, 'rename the button first')
    await data.sendNote(task, 'rename the button first')
    expect(await readComments('t1')).toHaveLength(1)
  })

  it('an after-deploy note is a comment and the need stays', async () => {
    const task = await seedTask(
      makeTask('t1', {
        stage: 'after_deploy',
        needs: { kind: 'after_deploy' },
        afterDeploy: ['A'],
        afterDone: [false],
      })
    )
    await data.sendNote(task, 'step A looks odd')
    const stored = await readTask('t1')
    expect(stored.needs).toEqual({ kind: 'after_deploy' })
    expect(stored.stage).toBe('after_deploy')
    const [comment] = await readComments('t1')
    expect(comment).toEqual(
      expect.objectContaining({ author: 'james', kind: 'comment', body: 'step A looks odd' })
    )
  })

  it('a note on a finished task is a comment, task otherwise unchanged', async () => {
    const task = await seedTask(makeTask('t1', { stage: 'done', doneAt: 1_700_000_100_000 }))
    await data.sendNote(task, 'thanks, one more thing')
    const stored = await readTask('t1')
    expect(stored.stage).toBe('done')
    expect(stored.needs).toBeNull()
    const [comment] = await readComments('t1')
    expect(comment).toEqual(
      expect.objectContaining({ author: 'james', kind: 'comment', body: 'thanks, one more thing' })
    )
  })

  it.each(['', '   \n '])('blank text %j writes nothing', async (text) => {
    const task = await seedTask(
      makeTask('t1', { stage: 'spec', needs: { kind: 'spec' }, spec: SPEC })
    )
    await data.sendNote(task, text)
    await expectUntouched(task)
  })
})
