import { defineConfig } from 'vitest/config'

// Firestore security-rules tests. Run only inside the emulator:
//   npm run test:rules   →  firebase emulators:exec --only firestore "vitest run --config vitest.rules.config.ts"
// Needs Java 11+ for the emulator (Microsoft.OpenJDK.21 via winget on the desktop; preinstalled
// on GitHub's ubuntu runners). FIRESTORE_EMULATOR_HOST is set by emulators:exec.
export default defineConfig({
  test: {
    include: ['tests/rules/**/*.test.ts'],
    testTimeout: 20_000,
    hookTimeout: 30_000,
    fileParallelism: false,
  },
})
