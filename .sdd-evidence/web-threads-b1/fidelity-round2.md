# Fidelity gate — round 2 (FAIL)

Checker: a second fresh Claude subagent, role `verify`, anthropic/claude-opus-5-5, profile
anthropic-only (isolation: context); round-1 verdict withheld from it. Same inputs as round 1
plus the spec's "B1 contract details fixed at test time" subsection.

Summary: criteria 1–3 and all contract items well encoded; red real (37 failures, all missing
exports or unchanged rules/index files). FAIL on criterion 4 strength and small contract holes.

Gaps (verbatim, abridged to the fields):

1. weak-assertion · b1-4 "every allow is either owner-gated or false" — `startsWith('isOwner()')` accepts `isOwner() || true`.
2. weak-assertion · b1-4 "agents stay read-only" — extra `allow update: if isOwner();` in the block passes.
3. weak-assertion · b1-4 "James's comment create is limited…" — only first `allow create` inspected; a second `allow write: if isOwner();` bypasses.
4. weak-assertion · b1-4 "only the verified owner e-mails count" — `toContain` on isOwner() body; authoredByJames() body unchecked.
5. missing-edge-case · contract "a 201st entry archives exactly the oldest one" — non-mutation unchecked on the overflow path.
6. weak-assertion · contract "an oversized log returns all the overflow" — kept order not verified.
7. missing-edge-case · contract "a new feature task starts at spec…" — `lastCommentAt: null` not asserted.
8. weak-assertion · b1-4 "has the stage and doneAt task indexes" — `queryScope` ignored.

Gaming flags (verbatim, abridged):

- comments block + `allow write: if isOwner();` passes.
- agents block + `allow update: if isOwner();` passes.
- `allow update, delete: if isOwner() || true;` passes the every-allow test.
- appendLog that `splice`s the input on overflow passes.

Not reported as gaps (out of the enumerated audit scope): agent-compat paths `kanban_subtask
status:'done'` advancing the stage and `kanban_update_task status:'in_progress'` clearing
`needs` are untested in the live protocol test.

Action: all eight items fed back to the test author as revision round 2 (final); no new planner
decisions required.
