# Fidelity gate — round 3 (FAIL) → escalated to the human

Checker: a third fresh Claude subagent, role `verify`, anthropic/claude-opus-5-5, profile
anthropic-only (isolation: context); earlier verdicts withheld. Two revision rounds were
spent (the skill's maximum), so this verdict escalates.

Summary (checker's words, abridged): criteria 1–3 and every contract item are strong — exact
values, all named edge cases, no stub found short of a correct implementation; protocol.ts
edits grounded; hygiene clean; red run honest (37 failed, all for missing behaviour). FAIL on
criterion 4 only: the static rules tests inspect the first matching `match` block, while
Firestore ORs every matching rule, so the intended rules plus one owner catch-all block
(`match /{collection}/{doc} { allow read, write: if isOwner(); }`) passes all seven rules
tests while making `agents` writable and comment kinds unrestricted (verified by the checker
with a scratch script). A collection-group `match /{path=**}/log_archive/{e}` also escapes
the archive-path check (owner-only still, so the security property holds).

Gaps (verbatim fields):

1. weak-assertion · b1-4 "agents stay read-only" — only the first `/agents/{id}` block inspected. Fix: enumerate every match head (top-level and nested), assert the exact expected set with each path defined once, and each rules function defined once.
2. weak-assertion · b1-4 "James's comment create is limited…" — same cause. Fix: same whole-file enumeration.
3. weak-assertion · b1-4 "the archived task log… reachable only under its task" — regex cannot match across a wildcard segment. Fix: match any head containing `log_archive`, or rely on the exact match-head set.

Gaming flags: the owner catch-all block (passes all seven rules tests); a later duplicate
`match /comments/{cid} { allow create: if isOwner(); }`.

Diagnosis for the human: criterion 4 is a _behavioural_ rules criterion ("the owner's write
succeeds, any other principal is refused") being tested by static text analysis because the
Firestore emulator needs Java, which this machine lacks (AGENTS.md gotcha). Static analysis
can only ever approximate Firestore's "any matching allow grants" semantics; the checker is
right that it keeps finding a bypass. Options are in the session transcript.
