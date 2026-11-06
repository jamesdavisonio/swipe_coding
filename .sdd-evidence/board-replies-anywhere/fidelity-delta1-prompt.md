# Fidelity delta check 1 — board-replies-anywhere R1

Role: `verify`, fresh context. A full fidelity audit of these tests returned FAIL with the six gaps
below; the test author revised the tests. Check ONLY whether each listed gap is now closed (and
that the revision did not weaken anything it touched). Do not re-audit the rest.

Inputs: the spec `docs/features/board-replies-anywhere.md` (contract section "R1 contract details
fixed at test time"; note the new tool's comment author is `agent`), the revised files
`tests/emulator/board-replies-anywhere-r1-5.test.ts`, `-r1-6`, `-r1-7`, `-r1-9`, the fixture
`tests/fixtures/board-replies-anywhere-emulator.ts`, and the observed sources in
`packages/agent/src` (app-log.ts for logFailure's log line, board.ts, index.ts).

Gaps:

1. r1-6 "replies already waiting when both start": a watcher losing every claim and exiting 0 with
   empty stdout passed (a fallback watcher picked up the rest). Contract: it goes back to waiting.
   Wanted: assert every exited watcher run printed at least one line.
2. r1-9 "clears the question…": only a pending James answer was seeded; the tool must mark only
   kind `answer`. Wanted: a pending James `comment` stays deliveredAt null and a later watcher
   prints it.
3. r1-9 "refuses a task with no open question": only needs null was tried. Wanted: needs
   {kind:'spec'} refused with `no open question`, needs unchanged.
4. r1-5: the final needs-null check was vacuous. Wanted: needs still equals the question while the
   answer waits, null after the next watcher prints it.
5. r1-7: offline and shut-down-while-waiting did not assert the WARNING api_call_failed. Wanted:
   offline stderr contains logFailure's `api_call_failed WARNING` line; while-waiting a stored
   WARNING api_call_failed with context target 'watcher', status 'shut_down'.
6. r1-9: assert the session note's author is exactly 'agent'.

Also re-check the three gaming flags these gaps came from: (a) a watcher that loses every claim
exits 0 with no output; (b) the tool marks every pending James comment, not only answers; (c) the
tool accepts any non-null needs. Each must now fail at least one test.

Return a few lines of notes, then JSON:
{"verdict":"PASS"|"FAIL","gaps":[{"n":1,"closed":true|false,"why":"..."}],"gaming_flags":[{"flag":"a","caught_by":"<test>"|null}],"new_gaps":[...]}
