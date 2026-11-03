# Prompt-grounding receipt — B4 builder

- Role: build (claude-sonnet, fresh context, background subagent)
- Source snapshot: 9413961 (red checkpoint), branch feat/web-threads-b4
- Criteria: B4 16–20; 28 tick half; 29 sheet write-failure state; 30 on the sheet; emulator tests of sendReply and markRead
- Brief: scratchpad/builder-brief-web-threads-b4.md, sha256 16005beabffb9de151a67ea1db99c8b05e5cf9fd46e99774933950b32c1bb6ee
- Excluded: fidelity verdicts (scratchpad/ev-b4, outside the repo), test-author packet, planning discussion; `.sdd-evidence/` declared out of scope
- Preflight: builder rules verbatim; every write, guard, label and history text the tests use is in the spec's B4 block and round-1 decisions; edit targets exist; the emulator harness for data.ts was proved before test authoring (commit 81a6345)
- Test author packet sha256 (final, after round-1 addendum): 206b2cd43afece488a254ea8b3728757b06509bbc5646afddfd18f461ff8645d (3dcd898b… at first dispatch)
