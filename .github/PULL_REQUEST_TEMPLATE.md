## What changes

<one paragraph — what James observes changing on the board, in the agent, or in a session>

## Why

<one paragraph — link to the spec at docs/features/<slug>.md or the ADR>

## Evidence

Paste the `check --full` verdict (or `check --security` if the diff touches auth, rules, input boundaries or writes):

```
CHECK REPORT — <depth> — <date>
...
VERDICT: <READY | READY WITH WARNINGS>
```

For features shipped via `implement-feature`:

- Red-checkpoint SHA: `<sha>`
- Fresh-context reviewer verdict: `<shippable | needs-changes>`

## Principles applied

<list the _principles/ files the change touched and one line on how>

## Rollback

<how to revert — commit to revert, Hosting rollback, rules redeploy>

## Screenshots / recordings

<for UI changes, light and dark; otherwise delete this section>

## Checklist

- [ ] `check` verdict is READY (or READY WITH WARNINGS with justification above)
- [ ] Tests added or updated; failing test committed before implementation for new behaviour
- [ ] `docs/` updated where a stable fact changed; DESIGN.md if a decision changed
- [ ] AGENTS.md still under ~2KB
- [ ] No test files modified since the red-checkpoint SHA (or explicit justification)
