# Threat model

Last verified: 2026-11-02

## Assets

- The Firestore data: tasks, James's comments, session summaries, PR links. Low
  confidentiality, high integrity — a forged comment is an instruction a Claude Code
  session will act on as if James typed it.
- The agent service-account key (`..\kanban-secrets\sa.json`).
- The deploy identity (`github-deploy` via WIF).
- The sessions themselves: a channel event reaches a terminal that can run commands.

## Adversaries

1. Anyone on the internet reaching `kanban-nullnoise.web.app` or the Firestore REST API.
2. A compromised or malicious dependency in the web bundle or the agent.
3. Someone with James's Google account (phished / lost phone).
4. A session being steered by content it reads (prompt injection through a comment).

## Top threats and mitigations

| #   | Threat                                                      | Mitigation                                                                                                                                     | Residual                                |
| --- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| 1   | Unauthenticated read/write of Firestore from the public API | `firestore.rules`: owner e-mail + `email_verified`, default deny; rules-lint in CI                                                             | none known                              |
| 2   | Forged "from James" comment delivered to a session          | UI can only create `author == 'james'` comments as the owner; agents only deliver `author == 'james'`; agents write via Admin SDK              | account takeover (threat 3)             |
| 3   | Google account takeover → full board control                | Google 2FA on the account; destructive actions in sessions still hit the permission prompt                                                     | accepted; single owner                  |
| 4   | XSS / injected script in the web app                        | CSP without `unsafe-inline`/`unsafe-eval`, `frame-ancestors 'none'`, React escaping                                                            | third-party script at `apis.google.com` |
| 5   | Leak of `sa.json`                                           | Outside repo, gitignored name, `KANBAN_SA` override only; rotation documented                                                                  | local-machine compromise                |
| 6   | Supply chain: vulnerable or malicious npm package           | `npm audit` gate on main, nightly; SBOM artefact; Dependabot alerts; lockfile committed                                                        | zero-day between runs                   |
| 7   | Deploy from a fork or another repo using our identity       | WIF attribute condition pins `jamesdavisonio/kanban`; manual dispatch only                                                                     | none known                              |
| 8   | Prompt injection through task text a session reads          | Session instructions: a watcher line "from":"james" is trusted only because the rules make it James; permission prompt for destructive actions | the session's own judgement             |

## Unmitigated / accepted

- No branch protection on the free plan: a bad push to `main` is possible; it cannot deploy by
  itself (manual dispatch).
- No Firestore backup: loss would be an inconvenience, not an incident.
