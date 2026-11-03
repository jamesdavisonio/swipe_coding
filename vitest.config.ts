import { defineConfig } from 'vitest/config'

// `npm test`: every unit test under tests/, except the Firestore rules suite, which needs
// the emulator and runs through `npm run test:rules` (vitest.rules.config.ts).
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    exclude: ['tests/rules/**', '**/node_modules/**'],
  },
})
