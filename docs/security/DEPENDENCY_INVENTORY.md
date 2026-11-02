# Dependency inventory

Last verified: 2026-11-02

Top-level dependencies and why they are here. Refresh on major bumps or when
`pre-deploy-check` flags drift. Full tree: the SBOM artefact from the security-gatekeeper
workflow.

## Runtime — `packages/web` (browser bundle)

| Package                               | Why                                  |
| ------------------------------------- | ------------------------------------ |
| react, react-dom 19                   | UI                                   |
| react-router                          | client routing                       |
| firebase 12                           | Auth (Google) + Firestore client SDK |
| tailwindcss 4 (+ `@tailwindcss/vite`) | styling, compiled at build           |

## Runtime — `packages/agent` (desktop, Node 24)

| Package                   | Why                                             |
| ------------------------- | ----------------------------------------------- |
| @modelcontextprotocol/sdk | the MCP / Claude Code channel server over stdio |
| firebase-admin 13         | Firestore with the service-account key          |

## Shared

`packages/shared` has no dependencies (types, templates, pure functions).

## Tooling (dev only, not shipped)

vite, typescript, vitest, eslint 9 + typescript-eslint 8, prettier, husky, lint-staged,
commitlint, firebase-tools, @types/node.

## Known advisories carried deliberately

| Advisory                                                            | Where                                                | Status                                                                                                                                                                                                   |
| ------------------------------------------------------------------- | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GHSA-m9gg-hp2v-232j, GHSA-f596-whhp-79r4 (`@grpc/grpc-js` < 1.13.6) | `firebase` → `@firebase/firestore` (Node build only) | Allowlisted in `scripts/audit-allowlist.json` until 2027-02-01; not reachable from the browser. npm `overrides` cannot reach workspace trees. Remove the entries when `firebase` lifts its `~1.9.0` pin. |

## Policy

- Lockfile committed; CI installs with `npm ci`.
- Dependabot alerts-only; bumps are done by hand on the cadence in
  `OPERATIONS_MAINTENANCE.md`.
- New runtime dependency → one line in this file in the same PR.
