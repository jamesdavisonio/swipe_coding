import { defineConfig } from 'vitest/config'

// `npm test`: every unit test under tests/, except the Firestore rules suite, which needs
// the emulator and runs through `npm run test:rules` (vitest.rules.config.ts).
// Web component tests are .test.tsx files that opt into jsdom with a
// `// @vitest-environment jsdom` docblock; JSX uses React's automatic runtime like the app.
export default defineConfig({
  esbuild: { jsx: 'automatic' },
  test: {
    include: ['tests/**/*.test.{ts,tsx}'],
    exclude: ['tests/rules/**', 'tests/emulator/**', '**/node_modules/**'],
  },
})
