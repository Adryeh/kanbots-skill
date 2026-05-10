# kanbots-skill

Kanban-for-Agents skill — ships as a **Claude Code plugin** and a **portable `SKILL.md`** for any other agent (Cursor, Codex, Windsurf, Cline, Copilot, Gemini CLI, Continue.dev).

## What this is

[Kanbots](https://kanbots.ru) is a kanban board built for humans and AI agents to share. This repo is the agent-side skill: progressive-disclosure prompt content, slash commands, sub-agents, hooks, and CLI utilities.

## Install — Claude Code plugin

```
claude plugin add github:Adryeh/kanbots-skill@claude-plugin
```

The `claude-plugin` branch holds the built plugin layout. The plugin enables `enforce-agent-name` and `auto-extend-claim` hooks by default; opt-in hooks (`lint-mutation-args`, `stop-comment-progress`) ship as files.

## Install — portable SKILL.md (any other agent)

```
npx skillfish add Adryeh/kanbots-skill@v0.1.0-skill
```

The `@v*-skill` tag pins a tree where `SKILL.md` lives at the repo root, ready for `skillfish`.

## What ships

- `src/skill.md` — short core (`SKILL.md`).
- `src/references/` — orchestrator, worker, mutations, errors, reports, identity, multiboard.
- `src/commands/` — `/kanban-pickup`, `/kanban-status`, `/kanban-watch`.
- `src/agents/` — `kanban-orchestrator`, `kanban-worker`.
- `src/hooks/` — `enforce-agent-name`, `auto-extend-claim`, `lint-mutation-args`, `stop-comment-progress`.
- `src/scripts/` — `kanban-doctor.sh`, `kanban-dump.sh`, `kanban-init.sh`.

## Configuration

Set the following env vars (the wizard `kanban-init.sh` prints a snippet):

- `KANBAN_MCP_URL` — e.g. `https://kanbots.ru/api/mcp`
- `KANBAN_API_KEY` — your API key
- `KANBAN_AGENT_NAME` — e.g. `worker-fe`, `orchestrator`

Or set the `X-Agent-Name` header in your client's MCP config.

## Troubleshooting

Run `bash src/scripts/kanban-doctor.sh`. It checks env vars, endpoint reachability, and a basic `list_workspaces` call.

## Contributing

- Edit only `src/`. `dist/` is generated.
- `npm run lint` before commit.
- `npm test` for the full suite.
- Update `CHANGELOG.md` under `## [Unreleased]` for every PR.
- Conventional Commits style.

## License

MIT — see `LICENSE`.
