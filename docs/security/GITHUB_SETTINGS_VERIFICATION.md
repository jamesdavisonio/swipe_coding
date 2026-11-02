# GitHub settings verification

Last verified: not yet — commands below are for James to run; paste outputs here.

Repository: `jamesdavisonio/kanban` (private, personal account, free plan).

## What the plan allows

On a private repository under a free personal plan GitHub does **not** enforce branch
protection rules or environment protection rules (required reviewers). The API calls either
fail or are accepted without effect. `SECURITY.md` records this as a gap rather than
pretending the gate exists. Everything below that _is_ available is still set.

## 1. Actions token read-only by default

```bash
gh api repos/jamesdavisonio/kanban/actions/permissions/workflow -X PUT \
  -f default_workflow_permissions=read \
  -F can_approve_pull_request_reviews=false
gh api repos/jamesdavisonio/kanban/actions/permissions/workflow
```

Expected: `"default_workflow_permissions": "read"`.

## 2. Repository variables for the web build

Public Firebase identifiers (same values as `packages/web/.env`), as **variables**, not
secrets:

```bash
gh variable set VITE_FIREBASE_API_KEY --repo jamesdavisonio/kanban
gh variable set VITE_FIREBASE_AUTH_DOMAIN --repo jamesdavisonio/kanban
gh variable set VITE_FIREBASE_APP_ID --repo jamesdavisonio/kanban
gh variable list --repo jamesdavisonio/kanban
```

(Each `set` prompts for the value on stdin — do not pass it as an argument.)

## 3. `production` environment

```bash
gh api repos/jamesdavisonio/kanban/environments/production -X PUT
gh api repos/jamesdavisonio/kanban/environments --jq '.environments[].name'
```

A required reviewer cannot be attached on this plan; the deploy workflow is
`workflow_dispatch` only, which is the equivalent deliberate click.

## 4. Branch protection (attempt; expected not to enforce)

```bash
gh api repos/jamesdavisonio/kanban/branches/main/protection -X PUT --input - <<'JSON'
{
  "required_status_checks": { "strict": true, "contexts": ["fast-feedback"] },
  "enforce_admins": true,
  "required_pull_request_reviews": null,
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false
}
JSON
```

If it returns 403 "Upgrade to GitHub Pro", record that here and leave the gap row in
`SECURITY.md`.

## 5. Dependabot alerts

Settings → Code security → Dependabot alerts: **on** (free on all plans).

## Record

| Check                    | Result | Date |
| ------------------------ | ------ | ---- |
| Actions token read-only  |        |      |
| Repository variables set |        |      |
| `production` environment |        |      |
| Branch protection        |        |      |
| Dependabot alerts        |        |      |
