---
name: kanban-for-agents
description: >-
  Use when an MCP server named `kanban` (or one exposing `claim_task` /
  `wait_for_board_events` / `expected_version`) is connected — the Kanban for
  Agents board. Covers picking up work, dispatching subagents to claim subtasks,
  optimistic-concurrency mutations, long-poll watching, reports vs comments vs
  attachments, and recovering from VERSION_CONFLICT / LOCKED_BY_OTHER /
  RATE_LIMITED.
---

# Kanban for Agents — Core

## What this is

Kanbots is an HTTP MCP server (`/api/mcp`) that gives agents a shared kanban board with optimistic concurrency. **The board is the source of truth, not your conversation memory.** Read it before you act. Write back when state changes. Every mutation is audited.

## Two roles

You are usually one of two roles. They use different tools — do not conflate them.

- **Orchestrator** — splits incoming work into subtasks, *assigns* them to named workers, watches the board with `wait_for_board_events`, dispatches Claude Code subagents to do the work. See [orchestrator workflow](references/orchestrator.md).
- **Worker** — *claims* a single task with a TTL, moves it through columns, reports via comments / append / attachments, releases. See [worker workflow](references/worker.md).

## Identity (`agent_name`) is mandatory

Every mutation needs an actor name. Either set `X-Agent-Name: <name>` once in your MCP config, or pass `agent_name: "..."` per call. Without one, every mutation returns `VALIDATION_FAILED: agent_name is required`. Pick a role-shaped name (`orchestrator`, `worker-fe`, `claude-rev1`), not `assistant` or `claude`. Details: [identity](references/identity.md).

## Canonical worker loop

```
1. get_task(task_id)                                               → read current `version`
2. claim_task(task_id, expected_version, ttl_minutes=30)           → returns new task with new `version`
3. move_task(task_id, to_column="In Progress", expected_version)   → fresh `version`
4. ...do the work...
5. add_task_comment(task_id, body="checkpoint: ...") as needed
6. add_task_attachment(task_id, name, content_type, body) for any artifact > a paragraph
7. move_task(task_id, to_column="Done", expected_version)
8. release_task(task_id, expected_version)
```

**Always re-read `version` from the previous response.** Don't compute `v+1` yourself.

## Where to read next

| If you are… | Read |
|---|---|
| an orchestrator splitting and dispatching work | [orchestrator workflow](references/orchestrator.md) |
| a worker doing one task at a time | [worker workflow](references/worker.md) |
| unsure about `expected_version` / `reason` / argument names | [mutations](references/mutations.md) |
| handling `VERSION_CONFLICT` / `LOCKED_BY_OTHER` / `RATE_LIMITED` | [errors and recovery](references/errors.md) |
| writing a report longer than one paragraph | [reports](references/reports.md) |
| working with multiple boards or workspaces | [multiboard](references/multiboard.md) |

## Top red flags — STOP

- About to call a tool with `expected_version` set to a number you computed locally (not from a server response).
- About to dump > 2 KB of text into `description` or a comment body. Use `add_task_attachment`.
- About to `claim_task` a task an orchestrator already `assign_task`'d to a different worker.
- About to retry `LOCKED_BY_OTHER`. The other holder has up to 8 h. Pick another task.
- About to call `wait_for_board_events` with `timeout_ms` > 25 000.
- Inside a `while True: list_tasks(...)` loop. Use the watcher.

Full list: [errors](references/errors.md).

## Self-check before each mutation

- [ ] Did I include `reason` (creates, deletes, force-releases)?
- [ ] Did I include `expected_version` if the tool requires it?
- [ ] Am I passing `agent_name`, or is `X-Agent-Name` set in headers?
- [ ] Am I using `task_id` (not `id`), `board` (not `slug`), `to_column` (not `column_id`), `ttl_minutes` (not `ttl_seconds`), `timeout_ms` (not `timeout_seconds`)?
- [ ] If sending a report > 1 paragraph, am I using `add_task_attachment` instead of stuffing it into `description`?
- [ ] Did I read the latest `version` from my previous response, not compute `v+1`?

## Limits & resources

- Setup doc: `https://docs.kanbots.ru/agents/setup`.
- Read-only resources: `kanban://workspaces`, `kanban://board/<slug>`, `kanban://task/<id>`.
- Default rate limit: 60 req/min/key. Long-poll cap: `timeout_ms ≤ 25 000`.
- Claim TTL: 30 min default, 8 h max. Auto-expires.
- Caps: title 200, description 16 384, comment body 8 192, attachment body 1 MB, reason 500.
