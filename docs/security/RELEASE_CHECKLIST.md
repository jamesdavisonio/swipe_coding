# Release checklist

Last verified: 2026-11-02

The ladder `promote` walks. Solo developer: Owner and Verifier are both James, so each gate
is a deliberate step with evidence, not a second pair of eyes.

## Gate A — local ready

- [ ] `check --full` READY on the branch; report pasted in the PR body.
- [ ] Commit messages Conventional (commitlint passes); micro-spec or `docs/features/<slug>.md`.
- [ ] `docs/` updated for any stable fact that changed; `SECURITY.md` row if security-relevant.

## Gate B — reviewed

- [ ] PR open against `main`, CI fast feedback green.
- [ ] Test files unchanged since the red checkpoint (or justified in the PR).
- [ ] For UI changes: screenshots light + dark in the PR.

## Gate C — pre-deploy

- [ ] Merged to `main`; security gatekeeper green on that SHA.
- [ ] `pre-deploy-check` READY (whole-repo: secrets, deps, rules, headers, workflows).
- [ ] `node scripts/check-firestore-rules.mjs` passes.
- [ ] `firestore.indexes.json` matches the queries the web app runs (new query → new index).

## Gate D — production

- [ ] Actions → Deploy Firebase → Run workflow (or `npm run deploy`), from `main` only.
- [ ] `smoke-test-deployed` against `https://kanban-nullnoise.web.app`: headers present,
      CSP has no violations in the console after sign-in, Firestore reads work.
- [ ] Phone check: open the PWA, reply to a live task, see the session receive it.
- [ ] Release noted in `CHANGELOG.md` (`changelog` skill) once the project keeps one.

## Rollback trigger

Any of: sign-in broken, CSP blocking Firestore/Auth, rules rejecting James's own writes.
Hosting → previous release; rules → `git revert` + `firebase deploy --only firestore:rules`.
