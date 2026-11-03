# Prompt-grounding receipt — builder packet (web-threads B1)

- Job / role: implementer, role `build`, profile anthropic-only (isolation: context),
  model claude-sonnet (Agent tool `sonnet`), fresh context (not in-session).
- Source snapshot: red-checkpoint commit `1cd460467a6baa982d352fe48181b6bd2e64571a`
  (`test(web-threads-b1): red checkpoint for the shared stage model`), working tree clean at
  dispatch (`.sdd-evidence/` moved to the scratchpad for the duration of the build).
- Criteria: B1 criteria 1–4 (5 is a decision), "B1 contract details fixed at test time", the
  B1 items of "Selected new contract", agent compat.
- Final packet: `scratchpad/builder-brief-web-threads-b1.md`,
  SHA-256 `6365b168909f805e17e99b08bb867138cd3379dc5665bc1738ccf679be51998d`, plus the Agent
  prompt pointing at it (headline constraints repeated).
- Inputs listed in the packet: spec sections, ADR 0003, the frozen test files + red SHA, the
  taxonomy, the edit targets, builder-rules.md verbatim, the whole-repo green commands with the
  JDK PATH prefix and emulator-only rule. Explicitly withheld: the interview/plan transcript, every
  fidelity verdict and gaming flag, `.sdd-evidence/`, SKILL.md.
- Preflight (semantic): interfaces and fixtures are callable from the frozen tests and the spec's
  contract lines; exact names/shapes come from the spec's contract section (decisions) or the
  frozen tests; B2–B6 excluded; role boundary intact. Repo-specific deviations from the generic
  builder rules stated in the packet (no zod, no app/api, no `_principles/` folder on this
  machine — the spec's Principles section is the text to follow). Result: PASS.
- Hook: `implement-feature-red` marker armed with the red SHA before dispatch
  (`.claude/hooks/tests-readonly.mjs` via PreToolUse).
