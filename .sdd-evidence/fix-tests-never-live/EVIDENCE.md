# Evidence — fix/tests-never-live (the test runner never uses the live key)

Fix confirmed by James on 2026-11-06 ("fix confirmed"). Class: Small, upshifted to full
ceremony (never-downshift trigger: how the agent picks its service-account key). The spec is
the red checkpoint's commit message (`git show -s 467fd43`).
Profile: anthropic-only (context isolation). Repro written by the orchestrator (debug hop),
checked by two fresh Opus fidelity contexts (full audit, then delta). Implementer: Sonnet, fresh
context. Reviewer: Opus, fresh context.

## 1. Commits since the red checkpoint

```
70f563e fix(agent): the test runner never uses a service-account key
```

## 2. Test files since the red checkpoint

`git diff 467fd43..HEAD -- tests/` is empty.

## 3. Checks (on 70f563e; tails in `checks/`)

```
lint        PASS exit 0 (0 errors; pre-existing warnings)
typecheck   PASS exit 0
unit tests  PASS exit 0 (53 files, 544 tests)
build       PASS exit 0 (npm run build:web)
integration PASS exit 0 (test:rules 29 files / 233 tests; every agent child in emulator mode)
agent       PASS exit 0 on the second run (20 ok). The first run crashed mid-way with Windows
            status 0xC0000409 (a node process crash, no assertion failed); recorded as flaky.
prettier    PASS exit 0
```

Red → green: the repro went from 3 failed / 3 passed to 6 passed. The builder saw unit-test
timeouts under heavy machine load from other sessions (child-process tests past 5 s); a run on
a quieter machine passed 544 of 544.

## 4. Test fidelity

Round 1 (full audit): FAIL — acceptance 2 (emulator unchanged) untested; "no key file is read"
not observed; only the KANBAN_SA key tried, not a default location; no VITEST-alone case; a
wrong fix could make the test read the real key; temp keys not removed. Gaming flags: guard
before the emulator branch; force offline after reading the key; guard only with KANBAN_SA;
guard on VITEST_POOL_ID.

Delta round (fresh context; each stub applied, run and reverted), verbatim:

```json
{
  "verdict": "PASS",
  "gaps": [
    {
      "n": 1,
      "closed": true,
      "why": "'the emulator still works under the test runner' asserts mode emulator, the host and project in detail, and no getDb error, with VITEST and a KANBAN_SA key both set; stub (a) fails it"
    },
    {
      "n": 2,
      "closed": true,
      "why": "The preload records statSync/readFileSync/existsSync/accessSync/openSync/lstatSync calls on the key folder and offlineForTests asserts touches is empty; stub (b) fails 3 tests on that assertion"
    },
    {
      "n": 3,
      "closed": true,
      "why": "New case puts the key at %APPDATA%\kanban\sa.json (APPDATA=temp folder) with no KANBAN_SA; it goes through the same findSa default-location loop as the sibling path, and stub (c) fails it"
    },
    {
      "n": 4,
      "closed": true,
      "why": "'VITEST alone' strips every VITEST* var and sets only VITEST=true; stub (d) fails it"
    },
    {
      "n": 5,
      "closed": true,
      "why": "The child runs under --permission with reads limited to the repo and the temp folder; checked empirically that sibling-prefix folders and other paths are ERR_ACCESS_DENIED even for stat; afterEach removes each temp folder and none were left over"
    }
  ],
  "gaming_flags": [
    { "flag": "a", "caught_by": "the emulator still works under the test runner" },
    {
      "flag": "b",
      "caught_by": "a key named by KANBAN_SA is refused, unread, and the board stays offline"
    },
    {
      "flag": "c",
      "caught_by": "a key at a default location (%APPDATA%\kanban\sa.json) is refused, unread"
    },
    { "flag": "d", "caught_by": "VITEST alone, as in the runner main process, is enough" }
  ],
  "new_gaps": []
}
```

## 5. Fresh-context review

`VERDICT: shippable`. VITEST is set by vitest in its main process before config and globalSetup
and in every worker; every child a test spawns spreads `process.env`; every path that opens the
board in tests goes through `getDb()`; the emulator branch stays first. Follow-up (LOW): name
`VITEST` in the offline detail so a session accidentally started with it set says what to unset.
