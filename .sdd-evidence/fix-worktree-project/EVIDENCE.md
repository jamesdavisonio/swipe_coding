# Evidence: fix-worktree-project

Fix confirmed by James on 2026-11-09 ("Fix confirmed", in the session chat, recorded on the
board), on the New session task `jCPhbUFQX5BL373bGKwG`. Class: Small (agent identity, one new
helper).

Cause: the first launch from the phone ("Check", jamesdavison-site) ran in
`<repo>\.claude\worktrees\launch-<id>`; its agent derived the board project from that folder, so
it registered a new project (`launch-gwvzbnj7sasode9fz-a23ade1c`) and `kanban_start_task` refused
the queued task: "task … belongs to another project".

Profile: anthropic-only (isolation: context). Repro test: the orchestrator (plan role, as the fix
chain's debug hop). Implementer: an isolated Opus context. Reviewer: a fresh Opus context.

## 1. Commits since the red checkpoint (`db1b066`)

```
67a602e fix(agent): a worktree session belongs to its main checkout's project
```

## 2. Test changes after red

None: `git diff db1b066..HEAD -- tests` is empty.

## 3. Checks

- Repro `tests/emulator/fix-worktree-project.test.ts`: red at `db1b066` (2 failed, e.g.
  `expected 'launch-abc123-…' to be 'wtfix-…'`; the guard for main checkouts and plain folders
  passed), green after the fix (3 passed).
- Emulator suite: 73 files, 504 tests passed (implementer's run); in the reviewer's full run two
  `notifier-114` tests timed out under load and pass 10/10 alone (they do not import the changed
  code).
- `npm test`: 117 of 118 files; the failures are `tests/fix-tests-never-live.test.ts`, which
  cannot read this worktree's junctioned `node_modules` from its Node permission sandbox
  (environment only; CI runs it).
- `npm run test:agent`: all good. `npm run typecheck`: exit 0. `npx eslint .`: 0 errors.
  Prettier: clean.

## 4. Review

Fresh review: **shippable**. Checked by hand against the real jamesdavison-site launch worktree
and this repository's own worktrees (both resolve to the main checkout, native form), a worktree
subfolder, submodules, bare repos, a missing folder, git missing, and an older git (falls back to
the folder with one log line); nothing reaches stdout; about 40 ms per agent start.

Follow-ups (not built):

- A main checkout opened through a junction, an 8.3 short name or a subst drive keeps that path,
  while its worktrees resolve to the canonical path, so they would land in different projects.
  Every project path on this PC is canonical today; decide before canonicalising both sides
  (that would change existing project ids).
- No automated test of the git-failure fallback (checked by hand).
- `GIT_DIR` / `GIT_WORK_TREE` in the environment would redirect the check; the "not a git
  repository" match is English-only; a missing folder reads as "git ENOENT".
- The stray project from the first launch is removed by hand (board data, not code).
