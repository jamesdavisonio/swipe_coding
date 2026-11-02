// Toolchain proof for setup-project. The failing variant (expect(1 + 1).toBe(3)) was run
// first and recorded in the skeleton commit message; this placeholder keeps the suite green.
import { describe, expect, it } from 'vitest'

describe('toolchain', () => {
  it('placeholder passing test — vitest runs under Node 24', () => {
    expect(1 + 1).toBe(2)
  })
})
