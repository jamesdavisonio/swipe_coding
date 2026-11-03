// web-threads B1, criterion 3: delivery ticks on James's comments, derived from agent stamps.
import { describe, expect, it } from 'vitest'
import { deliveryState } from '../packages/shared/src/index.ts'

const stamps = (
  deliveredAt: number | null,
  workingAt: number | null,
  handledAt: number | null
) => ({
  deliveredAt,
  workingAt,
  handledAt,
})

describe('B1-3 comment delivery state', () => {
  it('a just-created comment is sent', () => {
    expect(deliveryState(stamps(null, null, null))).toBe('sent')
  })

  it('deliveredAt stamped → delivered', () => {
    expect(deliveryState(stamps(1, null, null))).toBe('delivered')
  })

  it('workingAt set → working', () => {
    expect(deliveryState(stamps(1, 2, null))).toBe('working')
  })

  it('handledAt set → handled', () => {
    expect(deliveryState(stamps(1, 2, 3))).toBe('handled')
  })

  it('never goes backwards when an earlier stamp is missing', () => {
    expect(deliveryState(stamps(null, null, 3))).toBe('handled')
    expect(deliveryState(stamps(1, null, 3))).toBe('handled')
    expect(deliveryState(stamps(null, 2, null))).toBe('working')
  })

  it('absent workingAt/handledAt fields read like null', () => {
    type Stamps = Parameters<typeof deliveryState>[0]
    expect(deliveryState({ deliveredAt: null } as Stamps)).toBe('sent')
    expect(deliveryState({ deliveredAt: 1 } as Stamps)).toBe('delivered')
  })
})
