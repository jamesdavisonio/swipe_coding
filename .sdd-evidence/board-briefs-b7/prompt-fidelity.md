You are auditing acceptance tests against a feature spec. You did not write
these tests, and the proposed implementation is withheld. Your question: do these
tests faithfully encode the spec, and would they catch a lazy or gaming
implementation?

Inputs I am giving you:

1. The feature spec at docs/features/board-briefs.md — audit ONLY section "B7 — Briefs, pull
   requests and finished-work summaries" (criteria 31–37), criterion 41 as it applies to B7's
   controls (Full spec, Copy, the one-tap answers), and the "B7 contract details fixed at test
   time" block (it builds on the web-threads.md B2–B4 blocks, which are shipped).
2. The test files drafted for it: tests/board-briefs-b7-_.test.ts(x),
   tests/emulator/board-briefs-b7-_.test.ts, and tests/fixtures/board-briefs-b7*.ts(x) if
   present (all uncommitted; `git status` lists them).
3. logging/taxonomy.json (B7 emits `user_action` and `api_call_failed`).
4. The author's grounded contract/baseline/harness packet and assigned criteria (it also
   quotes the skills' decision-brief format the board parses):
   C:\Users\Intel\AppData\Local\Temp\claude\C--Users-Intel-Documents-code-kanban\15399a86-1ff4-4831-8392-e476864b21fd\scratchpad\packet-test-author-b7.md

The emulator tests use the real Firestore emulator as their I/O (the agent's Board against it,
or the web data layer with firebase.ts pointed at it); that is real integration, not a mock of
the thing under test. Judge any test passing at red: legitimately pre-existing behaviour, or a
sign the test is too weak.

Walk every check. Do not stop at the first failure — report all of them.

Grounding:

- Missing relevant baseline or contract evidence is a hygiene gap, not permission
  to invent it. Check identifiers, schema keys, auth headers and harness exports.
- Distinguish observed facts from selected new contract details. Exact routes,
  payloads and statuses must be grounded in one of those, within confirmed scope.
- Baseline behaviour and proposed changes must remain distinguishable. A test
  failing because its baseline fixture cannot run is invalid red evidence.

Spec coverage:

- Map each acceptance criterion to the specific test(s) that encode it.
  For a partial draft, map the assigned subset and shared requirements; before
  the red checkpoint, the combined gate must map the whole feature spec.
  (This IS the combined gate for B7: B7 is one behaviour of a two-behaviour spec;
  B8 (voice) is a later run, out of this audit's scope.)
- Are the named edge cases for assigned criteria and applicable shared
  requirements each covered? The combined gate checks all spec edge cases.
- Does any test assert behaviour the spec does not ask for? Out-of-scope
  tests smuggle scope in; report them.

Would a bad implementation pass?

- Tautologies: does any test pass trivially (asserting a constant, asserting
  the mock, expect(true))?
- Stub test: imagine the laziest implementation that could pass each test
  (return hardcoded value, empty function, echo the input). If one exists,
  the test is too weak; report it with the stub that beats it.
- Are assertions specific (exact values, shapes, error codes) rather than
  loose (toBeDefined, toBeGreaterThanOrEqual(0), not.toThrow alone)? Exactness
  must follow the supplied contract; unsupported exact values are gaps too.

Test hygiene:

- Behavioural, not structural: tests assert what a caller observes, not
  internal functions/private state.
- Minimal mocks: only external I/O mocked. A test that mocks the thing under
  test proves nothing; report it.
- Error paths assert observable logging with the spec's taxonomy event_type,
  severity and required context using the isolated capture convention. Do not
  require ERROR/log.error for WARNING events or mock the logger under test.
  Verify each event_type exists in the supplied taxonomy.
- No .only / .skip / xfail / sleeps / retries anywhere.
- Test file names match the spec slug.

Output: a short human-readable summary first, then EXACTLY ONE fenced JSON
object, last thing in the message:

{
"verdict": "PASS" | "FAIL",
"criteria_map": [
{ "criterion": "<verbatim from spec>", "tests": ["<file>::<test name>"] }
],
"gaps": [
{ "type": "uncovered-criterion" | "missing-edge-case" | "weak-assertion" | "out-of-scope-test" | "hygiene",
"where": "<file>::<test name> | <criterion>",
"issue": "<one sentence>",
"fix": "<one sentence>" }
],
"gaming_flags": [
{ "where": "<file>::<test name>",
"stub_that_passes": "<the lazy implementation that would pass this test>" }
]
}

Verdict rule: PASS requires every assigned acceptance criterion mapped to at least
one non-tautological test, zero gaming_flags, and no hygiene violations.
Anything else is FAIL. There is no "PASS with reservations" — reservations
are gaps, and gaps mean FAIL.
