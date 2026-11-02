module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'header-max-length': [2, 'always', 100],
    'body-max-line-length': [1, 'always', 100],
    'subject-case': [2, 'never', ['upper-case', 'pascal-case', 'start-case']],
    // One scope per package or concern; add here when a new area appears.
    'scope-enum': [
      2,
      'always',
      ['web', 'agent', 'shared', 'firebase', 'docs', 'tooling', 'ci', 'deps', 'prototype'],
    ],
  },
}
