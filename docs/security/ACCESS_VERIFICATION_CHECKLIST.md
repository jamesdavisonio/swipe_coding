# Access verification checklist

Last verified: 2026-11-02 (register written; cloud state to be confirmed by James)

Cadence: quarterly, and after any IAM change. Record the date at the top when done.

## GCP project `kanban-nullnoise`

- [ ] Project IAM: only `james@nullnoise.ai` holds Owner. No other human principals.
      `gcloud projects get-iam-policy kanban-nullnoise --format=json | jq '.bindings'`
- [ ] `kanban-agent@kanban-nullnoise.iam.gserviceaccount.com`: role `roles/datastore.user`
      only; exactly one active key, created on a known date.
      `gcloud iam service-accounts keys list --iam-account=kanban-agent@kanban-nullnoise.iam.gserviceaccount.com`
- [ ] `github-deploy@kanban-nullnoise.iam.gserviceaccount.com`: no keys; roles exactly
      `firebasehosting.admin`, `serviceusage.apiKeysViewer`, `firebaserules.admin`,
      `datastore.indexAdmin`; WIF binding to repository `jamesdavisonio/kanban` only.
- [ ] Default compute SA has no Editor role (or the org policy enforces it).
- [ ] Firebase Auth: Google provider only; authorized domains are `localhost`,
      `kanban-nullnoise.firebaseapp.com`, `kanban-nullnoise.web.app`, `kanban.nullnoise.ai`.

## GitHub `jamesdavisonio/kanban`

- [ ] Collaborators: James only.
- [ ] Actions default token permission: read.
- [ ] Repository variables present: `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`,
      `VITE_FIREBASE_APP_ID`. No repository **secrets** holding Firebase credentials.
- [ ] Dependabot alerts enabled (Settings → Code security).

## Local machines

- [ ] `sa.json` exists only at `C:\Users\Intel\Documents\code\kanban-secrets\` (and the
      equivalent on the MacBook), never in a repo or in `%APPDATA%`.
- [ ] `claude mcp list` shows the `kanban` server registered user-wide from this repo's path.
