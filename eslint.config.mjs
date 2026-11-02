// Flat config (ESLint 9). Strict by default; every override below states why it exists.
import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import globals from 'globals'
import prettier from 'eslint-config-prettier'
import reactHooks from 'eslint-plugin-react-hooks'

export default tseslint.config(
  {
    // Build output, dependencies, the vendored governed logging files (agents read, humans
    // write), the single-file prototype, and Firebase's cache are never linted.
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      'coverage/**',
      'logging/**',
      'prototype/**',
      '.firebase/**',
      'packages/web/public/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: {
          // Files outside any package tsconfig still get type-aware rules.
          allowDefaultProject: ['packages/shared/src/*.ts', 'tests/*.ts', '*.mjs', '*.cjs'],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // The desktop agent must not write to stdout (it is the MCP transport); warn/error go
      // to stderr through log(). Anything else is a mistake.
      'no-console': ['error', { allow: ['warn', 'error'] }],
      'no-debugger': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/ban-ts-comment': [
        'error',
        { 'ts-ignore': true, 'ts-expect-error': 'allow-with-description' },
      ],
      '@typescript-eslint/no-non-null-assertion': 'warn',
      '@typescript-eslint/no-floating-promises': 'error',
      // React event handlers (onClick, onSubmit) are typed void but async handlers are the
      // idiom; the attribute case is exempted per typescript-eslint's own React guidance.
      // Every other misuse (callbacks, conditionals, spread) still errors.
      '@typescript-eslint/no-misused-promises': [
        'error',
        { checksVoidReturn: { attributes: false } },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: 'CatchClause > BlockStatement[body.length=0]',
          message:
            'Empty catch swallows errors. Handle explicitly or re-throw; see _principles/graceful-degradation.md.',
        },
      ],
    },
  },
  // Node packages and the test scaffold run on Node 24.
  {
    files: ['packages/agent/**/*.ts', 'packages/shared/**/*.ts', 'tests/**/*.ts'],
    languageOptions: { globals: globals.node },
  },
  // The web app runs in the browser; hooks rules catch stale closures and misordered hooks.
  {
    files: ['packages/web/src/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
  // Tests may log and use vitest globals; the agent's protocol test drives a child process.
  {
    files: ['tests/**', '**/*.test.*', '**/*.spec.*', 'packages/agent/test/**'],
    rules: { 'no-console': 'off' },
  },
  // Config files, scripts and Claude Code hooks are tooling, not product code.
  {
    files: ['**/*.config.*', 'scripts/**', '.claude/hooks/**', '*.mjs', '*.cjs'],
    languageOptions: { globals: globals.node },
    rules: { 'no-console': 'off' },
  },
  // Ambient declarations declare names they never use.
  {
    files: ['**/*.d.ts'],
    rules: { '@typescript-eslint/no-unused-vars': 'off' },
  },
  // Plain JS files have no type information; type-aware rules would error, not help.
  {
    files: ['**/*.{js,mjs,cjs}'],
    ...tseslint.configs.disableTypeChecked,
  },
  prettier
)
