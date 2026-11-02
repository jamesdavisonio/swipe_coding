# Operations & maintenance

Last verified: 2026-11-02

Single operator: James. There is no on-call; the board is a personal tool.

## Cadence

| When                | What                                                                                                                |
| ------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Every PR            | CI fast feedback green; `check --full` evidence in the PR body.                                                     |
| Every merge to main | Security gatekeeper (audit + SBOM) green. Red = fix or document in `DEPENDENCY_INVENTORY.md` before deploy.         |
| Nightly (automatic) | Gatekeeper re-runs the audit against the current advisory database.                                                 |
| Monthly             | Look at Dependabot alerts; bump what matters (`npm update`, then `npm run lint && npm test && npm run test:agent`). |
| Quarterly           | Walk `ACCESS_VERIFICATION_CHECKLIST.md`; re-score `SECURITY.md`.                                                    |
| On key suspicion    | Rotate `kanban-agent` key: create new → replace `sa.json` on both machines → delete old → restart sessions.         |

## Patching

- Node: track `.nvmrc` (24). Bump with a `chore(deps)` PR when the LTS line moves.
- Firebase SDKs: bump `firebase` and `firebase-admin` together; run the live agent test
  (`KANBAN_TEST_LIVE=1 npm run test:agent`) before merging.
- GitHub Actions: Dependabot alerts on `github-actions`; bump majors by hand.

## Incident response (what "incident" means here)

1. Unexpected writes on the board / sessions acting on comments James did not write:
   revoke the agent key, sign out all sessions of the Google account, check
   `firestore.rules` is the deployed version (`firebase deploy --only firestore:rules`).
2. Leaked `sa.json`: rotate as above; review Firestore for writes outside James's hours.
3. Bad deploy: Hosting release history → roll back (see `rollback` skill), then `git revert`.
4. Write an incident note at `docs/incidents/YYYY-MM-DD-<slug>.md` (timeline, blast radius,
   action, verification, follow-ups).

## Logs

Agent: stderr + `packages/agent/agent.log` on the machine that ran the session. Web: not
shipped anywhere yet (`docs/logging.md`). Firestore audit: Cloud Logging data-access logs
are off by default — enable if threat 2 in `THREAT_MODEL.md` ever materialises.
