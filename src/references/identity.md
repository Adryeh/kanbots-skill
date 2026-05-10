---
description: How to set agent_name — header vs per-call — and naming conventions.
---

# Identity

Every mutation needs an actor name. Two ways:

1. **Header (preferred for the whole session):** the MCP config sets `X-Agent-Name: <your-name>`. Then omit `agent_name` from every tool call.
2. **Per-call:** pass `agent_name: "..."` (1–80 chars, `[\w .,:/+\-@()]`) on each call.

If neither is set, *every* mutation returns `VALIDATION_FAILED: agent_name is required`.

## Naming

Pick a role-shaped name. Good: `orchestrator`, `worker-fe`, `claude-rev1`, `qa-bot`. Bad: `assistant`, `claude`, `agent`, `bot`. The name shows up in audit trails and in `list_my_claims`.

## Verifying your identity is set

Call `list_my_claims`. If it returns empty when you expect open claims, your name probably isn't propagating. Either:

- The MCP config doesn't set the header — check your client config.
- A per-call `agent_name` is overriding it with a different value.

A quick fix is to pass `agent_name="..."` explicitly on the next mutation; if that works while the header didn't, the header is mis-configured.

## Environment variable convention

This skill expects `KANBAN_AGENT_NAME` in the environment when relevant. Hooks (notably `enforce-agent-name`) read it.
