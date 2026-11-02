# Security & Compliance

## Green Standard

A control is Green when it is (a) enforced by tooling or configuration, (b) documented in
this file with a pointer, and (c) has evidence in `docs/security/`. Anything less than Green
is a Gap and is listed under **Current Gaps** with a date.

## Scope

A phone-first board where James follows and steers his local Claude Code sessions. One owner,
one browser user (James, Google sign-in), and N desktop agents (one per Claude Code session)
writing through the Firebase Admin SDK with a service-account key kept outside the repo. Data
is task metadata, James's comments and session summaries — no third-party users, no personal
data beyond James's own account, no payments. The trust boundary is the Firestore project
`kanban-nullnoise`: the web client is held to `firestore.rules`; the agents bypass rules and
are trusted because they run on James's machine with his key.

## Governing Baseline

- No regulatory surface (`compliance.gdpr: false`, `data_sensitivity: minimal`, single owner).
- Internal principles: `_principles/` in the skills repo — `error-schema`, `observability`,
  `traceability` are enforced (`.project-profile.yaml`); the rest apply per feature.
- GitHub free plan, private repo: no GitHub Advanced Security, no enforced branch protection.

## Project Profile

- Runtime: TypeScript on Node 24 — React 19 / Vite 7 / Tailwind 4 web app; firebase-admin
  desktop agent (MCP server). No Cloud Functions, no server of our own.
- Data sensitivity: minimal.
- AI: none in the app.
- Deploy: Firebase Hosting + Firestore rules/indexes, project `kanban-nullnoise` (eur3).
- Environments: production only.

## Evidence Registry

| Control                                    | Evidence                                                               | Owner         | Last verified   |
| ------------------------------------------ | ---------------------------------------------------------------------- | ------------- | --------------- |
| Firestore rules — owner-only, default deny | `firestore.rules`, `scripts/check-firestore-rules.mjs`                 | James Davison | 2026-11-02      |
| CSP + security headers                     | `firebase.json` → `hosting.headers`                                    | James Davison | 2026-11-02      |
| Secret handling                            | this file → Secret handling; `.gitignore`; `packages/web/.env.example` | James Davison | 2026-11-02      |
| CI: fast feedback                          | `.github/workflows/ci-fast-feedback.yml`                               | James Davison | 2026-11-02      |
| CI: security gatekeeper (audit + SBOM)     | `.github/workflows/security-gatekeeper.yml`                            | James Davison | 2026-11-02      |
| Deploy workflow (keyless, manual)          | `.github/workflows/deploy-firebase.yml`                                | James Davison | gap — see below |
| Dependabot (alerts-only)                   | `.github/dependabot.yml`                                               | James Davison | 2026-11-02      |
| Tests read-only during implement           | `.claude/hooks/tests-readonly.mjs` + `.claude/settings.json` (Tier A)  | James Davison | 2026-11-02      |
| Threat model                               | `docs/security/THREAT_MODEL.md`                                        | James Davison | 2026-11-02      |
| Access verification                        | `docs/security/ACCESS_VERIFICATION_CHECKLIST.md`                       | James Davison | 2026-11-02      |
| Dependency inventory                       | `docs/security/DEPENDENCY_INVENTORY.md`                                | James Davison | 2026-11-02      |
| Operations & maintenance                   | `docs/security/OPERATIONS_MAINTENANCE.md`                              | James Davison | 2026-11-02      |
| Release checklist                          | `docs/security/RELEASE_CHECKLIST.md`                                   | James Davison | 2026-11-02      |
| GitHub settings verification               | `docs/security/GITHUB_SETTINGS_VERIFICATION.md`                        | James Davison | gap — see below |
| Admin audit trail                          | `docs/security/ADMIN_AUDIT_TRAIL.md`                                   | James Davison | 2026-11-02      |

## Data Flow & Architecture

Phone/laptop browser → Google sign-in → Firestore (rules: owner e-mail, verified) ⇄ desktop
agents (Admin SDK, key at `..\kanban-secrets\sa.json`) → Claude Code session via the `kanban`
channel. Nothing leaves Google Cloud except to James's own devices; no third-party APIs are
called by the app. Details: `docs/architecture.md`, `DESIGN.md`.

### Content Security Policy

`firebase.json` serves on every path: `default-src 'self'`; `script-src 'self'
https://apis.google.com` (Firebase Auth popup helper); `style-src 'self'` — no
`unsafe-inline`, Tailwind 4 ships a stylesheet; `img-src 'self' data:
https://*.googleusercontent.com` (Google avatar); `connect-src` limited to the Firestore,
Identity Toolkit, Secure Token and `www.googleapis.com` endpoints; `frame-src` the Firebase
auth domain only; `frame-ancestors 'none'`; `object-src 'none'`. When the custom domain
`kanban.nullnoise.ai` becomes the `authDomain`, add it to `frame-src`.

## Secret handling

- **Service-account key** (`kanban-agent@kanban-nullnoise`, role Cloud Datastore User): one
  JSON key, on James's machines only, at `C:\Users\Intel\Documents\code\kanban-secrets\sa.json`
  (sibling of the repo, never inside it, never in `%APPDATA%` — MSIX virtualisation). Agents
  find it through `KANBAN_SA` or that path. Rotation: IAM → Keys → add new, replace the file,
  delete the old key.
- **Firebase web config** (`VITE_FIREBASE_*`): public identifiers, not secrets. Locally in
  `packages/web/.env` (gitignored); in CI as GitHub **repository variables** of the same names.
- **Deploy identity**: no key at all — Workload Identity Federation to
  `github-deploy@kanban-nullnoise` (setup below). A deploy workflow holding
  `FIREBASE_SERVICE_ACCOUNT` / `credentials_json` is drift; refuse it in review.
- `.gitignore` keeps out `.env`, `.env.*` (except `.env.example`), `sa.json`, `*.log`.
- Never pass a token as a CLI argument; never paste one into a session transcript.

## Access

| What                                 | Who                                                                         | Notes                                                                                                                      |
| ------------------------------------ | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| GCP project `kanban-nullnoise` owner | james@nullnoise.ai                                                          | Org policy override for SA key creation was made at project level.                                                         |
| Firestore data (web)                 | `j@nullnoise.ai`, `james@nullnoise.ai` only                                 | `firestore.rules` `isOwner()`; `agents` read-only from the UI.                                                             |
| Firestore data (agents)              | `kanban-agent@kanban-nullnoise` — Datastore User                            | Admin SDK, bypasses rules; trusted = James's machine.                                                                      |
| Production deploy                    | `github-deploy@kanban-nullnoise` via WIF, repo `jamesdavisonio/kanban` only | Roles: `firebasehosting.admin`, `serviceusage.apiKeysViewer`, `firebaserules.admin`, `datastore.indexAdmin`. Nothing else. |
| Manual deploy                        | James, `npm run deploy` with his own `firebase login`                       | Fallback until the workflow is verified.                                                                                   |
| Break-glass                          | James alone; nothing to escalate to                                         | Rotate the agent key; revoke the WIF binding by deleting the pool.                                                         |

## GitHub Repository Settings

| Control                                | Status                                    | Evidence                                        | Notes                                                                             |
| -------------------------------------- | ----------------------------------------- | ----------------------------------------------- | --------------------------------------------------------------------------------- |
| Actions token read-only by default     | To verify                                 | `docs/security/GITHUB_SETTINGS_VERIFICATION.md` | `gh api repos/…/actions/permissions/workflow`                                     |
| Branch protection on `main`            | Not enforceable — free plan, private repo | —                                               | Skills' own gates (`check`, PR template) stand in. Revisit on plan change.        |
| Required reviews on PRs                | n/a — solo developer                      | —                                               | Cannot approve own PR; `check --full` evidence in the PR body instead.            |
| `production` environment with reviewer | Not enforceable — free plan, private repo | —                                               | Deploy is `workflow_dispatch` only, so every deploy is a deliberate click anyway. |
| Signed commits required                | Accepted small-team risk                  | —                                               | Revisit at team ≥ 5.                                                              |
| Secret scanning + push protection      | Not enabled — paid feature                | —                                               | Secrets grep in `check --full` / `pre-deploy-check`.                              |
| Dependency review                      | Not enabled — paid feature                | —                                               | Dependabot alerts + gatekeeper audit cover the surface.                           |

## CI / Security Workflows

See `.github/workflows/`:

- All workflows declare top-level `permissions:`; `contents: read` everywhere, plus
  `id-token: write` on deploy only.
- No workflow uses `--no-verify`, no JSON credentials, no GitHub Advanced Security features
  (gitleaks, CodeQL, dependency-review) — they hard-fail on private repos without a paid tier.
- `npm run audit` (`scripts/check-audit.mjs`) is the merge-to-main gate: `npm audit
--omit=dev` at high+, where an advisory passes only if `scripts/audit-allowlist.json` lists
  it with a reason and an unexpired date. Today that list holds GHSA-m9gg-hp2v-232j and
  GHSA-f596-whhp-79r4 (`@grpc/grpc-js` 1.9.x pinned by the Firebase web SDK's Node build;
  the browser bundle never loads gRPC). npm `overrides` cannot fix this — they do not apply
  inside workspace dependency trees — so the entries expire 2027-02-01 and are re-judged on
  every `firebase` bump.

## Operations / Backup / Rollback

- Deploy trigger: Actions → Deploy Firebase → Run workflow (manual); or `npm run deploy`.
- Rollback: Firebase console → Hosting → release history → roll back; rules/indexes are in
  git — `git revert` and redeploy. Procedure: `rollback` skill.
- Backup: Firestore has no scheduled export yet (data is reconstructible and low value);
  listed as a gap.
- Monitoring: agents log to stderr + `agent.log`; web events are not yet shipped anywhere
  (`docs/logging.md`). No uptime check yet.

## Current Gaps

| Gap                                                                                                                       | Green by                          | Owner |
| ------------------------------------------------------------------------------------------------------------------------- | --------------------------------- | ----- |
| WIF pool + `github-deploy` SA not yet created; deploy workflow unverified                                                 | before first workflow deploy      | James |
| Repository variables `VITE_FIREBASE_API_KEY/AUTH_DOMAIN/APP_ID` not yet set                                               | same                              | James |
| Actions default token permission not yet verified read-only                                                               | 2026-11-09                        | James |
| Branch protection / environment reviewer unavailable on plan                                                              | on plan change                    | James |
| CSP verified against superstatic/config only, not on a live origin with sign-in (the Hosting emulator applies no headers) | first deploy or a preview channel | James |
| No Firestore export / backup schedule                                                                                     | when data matters                 | James |
| No uptime check on `kanban-nullnoise.web.app`                                                                             | first deploy                      | James |
| Client logging project `TBD-jamesdavisonio-logging-project`                                                               | see `docs/logging.md`             | James |

## Re-score Rule

This document is re-scored:

- On every security-relevant PR (author updates the row).
- Before every production deploy (`pre-deploy-check` verifies).
- Quarterly (James walks the Access and Repo Settings tables).
