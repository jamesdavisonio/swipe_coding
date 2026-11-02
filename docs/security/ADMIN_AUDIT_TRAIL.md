# Admin audit trail

Last verified: 2026-11-02

There is no admin role in the app: James is the only user, and every write he makes from
the UI is itself the audit record. What is logged, where, and for how long:

| Action                                             | Where it is recorded                                                                                  | Retention                                                         |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| James's comments, answers, approvals, reopen notes | `comments` collection (`author: 'james'`, `createdAt`, `deliveredAt`) and the task's decision history | Kept with the task (7-day list hide, never deleted automatically) |
| Task stage changes by sessions                     | task `subtasks` / stage fields, `updatedAt`; agent stderr + `agent.log`                               | As above; `agent.log` local                                       |
| Which session acted                                | `agents/{agentId}` (hostname, cwd, pid, Claude session id) referenced by `tasks.agentId`              | Agent docs kept; orphaned on exit                                 |
| Deploys                                            | GitHub Actions run log (Deploy Firebase) or James's terminal; Firebase Hosting release history        | GitHub 90 days; Hosting keeps releases                            |
| Rules / indexes changes                            | git history of `firestore.rules`, `firestore.indexes.json`                                            | forever                                                           |
| IAM changes on the GCP project                     | Cloud Audit Logs — Admin Activity (always on)                                                         | 400 days                                                          |
| Firestore data access by principal                 | Cloud Audit Logs — Data Access (**off**; enable if needed)                                            | —                                                                 |

## Gaps

- Web-client events (`logging/logger.browser.js`) are not shipped anywhere until the client
  logging project exists (`docs/logging.md`).
- No alert fires on writes outside James's hours; threat 2 in `THREAT_MODEL.md` relies on
  him noticing.
