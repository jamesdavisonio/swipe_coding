# Claude Code hooks for the kanban agent

The MCP server already registers the agent, heartbeats, and cleans up on a normal
exit. These two hooks add what only Claude Code knows (the session id) and cover
the case where the server process is killed without running its handlers.

Add to `~/.claude/settings.json` (merge into an existing `hooks` object):

```json
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node C:/Users/Intel/Documents/code/kanban/packages/agent/hooks/session-start.ts",
            "timeout": 15
          }
        ]
      }
    ],
    "SessionEnd": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node C:/Users/Intel/Documents/code/kanban/packages/agent/hooks/session-end.ts",
            "timeout": 15
          }
        ]
      }
    ]
  }
}
```

Both scripts read the hook JSON from stdin, use the same Firebase credentials as the
agent (`KANBAN_SA`, default `..\kanban-secrets\sa.json` next to the repo; or `FIRESTORE_EMULATOR_HOST`
for the emulator), log to `packages/agent/agent.log`, and always exit 0 so they never
block a session.

- `session-start.ts` — finds the live agent for this machine + working directory and
  stores `claudeSessionId` on it.
- `session-end.ts` — marks that agent offline and its active tasks `orphaned`.

MCP registration for the agent itself (user scope, so every project has it):

```json
// ~/.claude.json
{
  "mcpServers": {
    "kanban": {
      "command": "node",
      "args": ["C:/Users/Intel/Documents/code/kanban/packages/agent/src/index.ts"]
    }
  }
}
```

Start sessions with `claude --dangerously-load-development-channels server:kanban`.
