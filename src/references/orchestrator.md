---
description: Orchestrator workflow — splitting work, assigning to named workers, dispatching subagents, watching the board.
---

# Orchestrator workflow

## Loop

```
1. get_board(board=slug)                                  → cache columnIds
2. list_tasks(board, filters={column: "Backlog"})
3. For each big item:
     bulk_create_tasks(...) for subtasks
     append_to_task_description(parent, text="children: ...")
4. For each subtask:
     assign_task(task_id, assignee_name="worker-fe", reason="split from <parent>")
5. Dispatch one Claude Code subagent per assignee (see "Dispatching subagents" below).
6. Loop:
     wait_for_board_events(board, since_ts=last, timeout_ms=15000)
     - on task moved to Done → check parent: if all children Done, move parent to Done
     - on new task in Backlog → triage and assign
     - on `claim.expired` → reassign / re-dispatch
```

## `assign_task` vs `claim_task`

|                    | `assign_task`                                     | `claim_task`                                      |
| ------------------ | ------------------------------------------------- | ------------------------------------------------- |
| Semantics          | **Permanent ownership** ("worker-fe owns this")   | **Exclusive lease** ("I'm working on this *now*") |
| TTL                | None — sticky until reassigned                    | 30 min default, 8 h max, auto-expires             |
| Exclusive?         | No — multiple agents can act on it                | Yes — others get `LOCKED_BY_OTHER`                |
| Used by            | **Orchestrator** assigning work to a named worker | **Worker** locking a task while it works          |
| `expected_version` | Optional (omit for last-writer-wins)              | Required                                          |

You can do both atomically: `move_task(..., assign_to="worker-fe")` moves and assigns in one call. Use this when triaging Backlog → Ready: move + assign so the next agent sees a single consistent state.

## `bulk_create_tasks` gotcha

There is **one** top-level `column` for the whole batch. Every task in a single `bulk_create_tasks` call lands in the same column. Per-item only `title`, `description`, `priority`, and `labels` are accepted. To create across multiple columns, send multiple calls.

## Dispatching subagents

There is no `spawn_agent` MCP tool. Use Claude Code's Agent tool. Each subagent runs in its own context with the same Kanban MCP connection.

Briefing template (paste-and-fill):

```
You are the worker `<name>` on Kanban board `<board-slug>`. Your assigned task is
`<task-id>`. Use the kanban MCP server.

Workflow:
1. get_task(task_id="<task-id>") — read current `version`
2. claim_task(task_id="<task-id>", expected_version=<v>, ttl_minutes=30)
3. move_task(task_id, to_column="In Progress", expected_version=<v from step 2>)
4. Do the work locally. Save large outputs as attachments via add_task_attachment.
5. add_task_comment for short progress checkpoints.
6. move_task to "Done", then release_task.

Identity: pass `agent_name="<name>"` on every mutation, OR ensure X-Agent-Name
header is set in your MCP config.

If you hit VERSION_CONFLICT: get_task again, decide if your intent still applies
(e.g. moving to Done is still valid even if the title changed), then retry once
with the fresh version. After two conflicts, add_task_comment flagging it and stop.

If you hit LOCKED_BY_OTHER: stop. Don't poll. Comment what happened and exit.

Report back: task_id, final column, final version, attachment ids.
```

Spawn one Agent call per worker — they can run in parallel. Don't share a claim across subagents.

## Watching the board

Use `wait_for_board_events`, not a `list_tasks` poll loop.

```json
{"tool": "wait_for_board_events",
 "args": {"board": "web-redesign", "since_ts": <last>, "timeout_ms": 15000}}
```

- First call: omit `since_ts` to start "now".
- Every subsequent call: pass back `next_since_ts` from the last response. Same value de-dupes.
- `timeout_ms` cap is **25 000**. Pick 10–20 s to stay well under request budget.
- Returns immediately if events newer than `since_ts` are already buffered (last 200/board).

A 15 s long-poll ≈ 4 req/min when idle, leaving plenty of budget for mutations.
