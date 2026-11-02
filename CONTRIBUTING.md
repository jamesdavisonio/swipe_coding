# Contributing

Repo facts (stack, commands, conventions, gotchas) live in [AGENTS.md](AGENTS.md). Read it first.

## Workflow

Work runs through the portable skill set (`setup-*`, `ship`, `tweak`, `fix`, `change-ui`,
`check`). Ceremony scales with size:

- **Tiny** (one line, no behaviour change): edit directly, `check --fast`.
- **Small** (internal, no new public behaviour): `tweak` — micro-spec in the commit message,
  red checkpoint, `check --full`.
- **Medium+** (new behaviour, data shape, auth, input boundary, writes): `ship` →
  `clarify` → `implement-feature` (independent tests, fidelity gate, red checkpoint,
  tests read-only during build, fresh-context review) → `check` → docs → PR.
- **UI-only restyle**: `change-ui`.

Never downshift anything touching auth, secrets, Firestore rules, a new input boundary or a
new write path.

## Commits

Conventional Commits, enforced by commitlint:

```
<type>(<scope>): <imperative lower-case subject>
```

Types: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `perf`, `style`, `build`, `ci`,
`revert`. Scopes: `web`, `agent`, `shared`, `firebase`, `docs`, `tooling`, `ci`, `deps`,
`prototype`. The body says why; the diff says what. One logical change per commit.

## Before you commit

The pre-commit hook runs lint-staged (ESLint `--fix` + Prettier on staged files; tests are
linted but never auto-rewritten). A failing hook is a real block — do not use `--no-verify`.

```
npm run lint
npm run format:check
npm run typecheck
npm test
```

## Pull requests

Fill the template. Every PR carries a `check` verdict; features shipped through
`implement-feature` also carry the red-checkpoint SHA and the reviewer verdict. UI changes
include light and dark screenshots.

## Style

Prettier owns formatting: 2 spaces, single quotes, **no semicolons** (chosen over the
default because the codebase was already written that way), trailing commas where ES5
allows, 100 columns, LF line endings.
