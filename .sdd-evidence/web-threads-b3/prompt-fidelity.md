You are auditing acceptance tests against a feature spec. You did not write
these tests, and the proposed implementation is withheld. Your question: do these
tests faithfully encode the spec, and would they catch a lazy or gaming
implementation?

Inputs I am giving you:

1. The feature spec at docs/features/web-threads.md — audit ONLY section "B3 — Thread
   view" (criteria 13–15), criterion 2's "opened by id" clause, the shared criteria 28 (the
   reply half only), 29 and 30 as they apply to the thread view, and the "B3 contract
   details fixed at test time" block (it builds on the B2 block, which is already shipped).
2. The test files drafted for it: tests/web-threads-b3-*.test.tsx and
   tests/fixtures/web-threads-b3.tsx if present (all uncommitted; `git status` lists them).
3. logging/taxonomy.json (B3 emits `user_action` and `api_call_failed`).
4. The author's grounded contract/baseline/harness packet and assigned criteria:
   C:\Users\Intel\AppData\Local\Temp\claude\C--Users-Intel-Documents-code-kanban\15399a86-1ff4-4831-8392-e476864b21fd\scratchpad\packet-test-author-b3.md

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
  (This IS the combined gate for B3: B3 is one behaviour of a six-behaviour spec;
  B1 and B2 are shipped and B4–B6 are later runs, out of this audit's scope.)
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
