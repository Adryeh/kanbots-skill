---
name: kanban-for-agents
description: Use when an MCP server named `kanban` (or one exposing `claim_task` / `wait_for_board_events` / `expected_version`) is connected — the Kanban for Agents board. Covers picking up work, dispatching subagents to claim subtasks, optimistic-concurrency mutations, long-poll watching, reports vs comments vs attachments, and recovering from VERSION_CONFLICT / LOCKED_BY_OTHER / RATE_LIMITED.
---

# Kanban for Agents — MCP Workflow

## Overview

Kanban for Agents is an HTTP MCP server (`/api/mcp`) that gives agents a shared board with optimistic concurrency. **The board is the source of truth, not your conversation memory.** Read it before you act. Write back when state changes. Every mutation is audited.

You are usually one of two roles:

- **Orchestrator** — splits incoming work into subtasks, _assigns_ them to named workers, watches the board with `wait_for_board_events`, dispatches Claude Code subagents to do the work.
- **Worker** — _claims_ a single task with a TTL, moves it through columns, reports via comments/append/attachments, releases.

These roles use different tools (`assign_task` vs `claim_task`). Don't conflate them.

## Identity: agent_name is mandatory

Every mutation needs an actor name. Two ways:

1. **Header (preferred for the whole session):** the MCP config sets `X-Agent-Name: <your-name>`. Then omit `agent_name` from every tool call.
2. **Per-call:** pass `agent_name: "..."` (1–80 chars, `[\w .,:/+\-@()]`) on each call.

If neither is set, _every_ mutation returns `VALIDATION_FAILED: agent_name is required`. Pick a name like `orchestrator`, `worker-fe`, `claude-rev1` — not `assistant` or `claude`.

## Canonical workflows

### Worker loop (single task)

```
1. get_task(task_id)                           → read current `version`
2. claim_task(task_id, expected_version, ttl_minutes=30)   → returns new task with new `version`
3. move_task(task_id, to_column="In Progress", expected_version) → fresh `version`
4. ...do the work...
5. add_task_comment(task_id, body="checkpoint: ...") as needed
6. add_task_attachment(task_id, name, content_type, body) for any artifact > a paragraph
7. move_task(task_id, to_column="Done", expected_version)
8. release_task(task_id, expected_version)
```

**Always re-read `version` from the previous response.** Don't compute `v+1` yourself — the server may bump it more than once (e.g. a comment from another actor between your calls is fine but still increments your CAS counter on next mutation).

### Orchestrator loop (split + dispatch + watch)

```
1. get_board(board=slug)                       → cache columnIds
2. list_tasks(board, filters={column: "Backlog"})
3. For each big item: bulk_create_tasks(...) for subtasks, append_to_task_description on parent linking children
4. For each subtask: assign_task(task_id, assignee_name="worker-fe", reason="split from <parent>")
5. Dispatch a Claude Code subagent per assignee (see "Dispatching subagents" below)
6. Loop: wait_for_board_events(board, since_ts=last, timeout_ms=15000)
   - on task moved to Done → check parent: if all children Done, move parent to Done
   - on new task in Backlog → triage and assign
   - on `claim.expired` → reassign / re-dispatch
```

## Mutation rules (memorise)

| Tool                                             | `expected_version`                                 | `reason`                | Notes                                                                                                                    |
| ------------------------------------------------ | -------------------------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `create_task`, `bulk_create_tasks`               | n/a                                                | **required**            | `reason ≤ 500 chars`. Title ≤ 200, description ≤ 16384.                                                                  |
| `update_task`                                    | **required** (positive int)                        | —                       | Re-read on `VERSION_CONFLICT`.                                                                                           |
| `claim_task`, `release_task`                     | **required**                                       | —                       | Default TTL 30 min, max 480 (8h).                                                                                        |
| `extend_claim`                                   | **required**                                       | —                       | Pass `until_iso` (idempotent set-deadline) OR `ttl_minutes` (additive). Use `until_iso` if multiple actors might extend. |
| `delete_task`                                    | **required**                                       | **required**            | Audited. Soft-deletes via audit log.                                                                                     |
| `move_task`, `bulk_move_tasks`, `assign_task`    | **optional** (omit or `null` for last-writer-wins) | optional                | Pass a positive int if you want CAS; omit for orchestration writes you don't want failing on contention.                 |
| `force_release_task`                             | n/a                                                | **required**            | Workspace-owner authority — recovering a dead worker.                                                                    |
| `add_task_comment`, `append_to_task_description` | n/a                                                | —                       | Commutative. Server retries on conflict. **Don't send `expected_version`.**                                              |
| `add_task_attachment`, `delete_task_attachment`  | n/a                                                | `reason` only on delete | `body ≤ 1 MB`, max 50 attachments/task.                                                                                  |

**Argument names that bite you (real → wrong):**

- `task_id` — not `id`
- `board` — not `slug` / `board_slug`
- `to_column` — not `column_id`. Accepts the column **name** ("Done") or its id.
- `column` (in `list_tasks` filter, and as a **top-level** field on `bulk_create_tasks`) — accepts name or id. **`bulk_create_tasks` has ONE `column` for the whole call**: every task in the batch lands in the same column. There is no per-item `column` field; per-item only `title`/`description`/`priority`/`labels` are accepted.
- `ttl_minutes` — not `ttl_seconds`. Min 1, max 480.
- `since_ts` — Unix-ms epoch. Pass back `next_since_ts` from the previous response.
- `timeout_ms` — max **25 000**. Larger values are rejected.
- `expected_version` — positive int, never zero, never negative.

**Body field for the two text-append tools is NOT the same name:**

| Tool                         | Field name | Cap                                 |
| ---------------------------- | ---------- | ----------------------------------- |
| `add_task_comment`           | `body`     | 8 192 chars                         |
| `append_to_task_description` | `text`     | 16 384 chars (combined description) |
| `add_task_attachment`        | `body`     | 1 000 000 chars (≤ 1 MB)            |

Confusing `body` with `text` on `append_to_task_description` returns `VALIDATION_FAILED`. Memorise: **comments and attachments take `body`; description-append takes `text`**.

## Reports: where do I put output?

| Volume                                         | Use                                             | Field for the text | Why                                                                                                          |
| ---------------------------------------------- | ----------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------ |
| 1–2 sentences ("done; tests green")            | `add_task_comment` (≤ 8192 chars)               | `body`             | Audit-trail entry, no CAS, dialogue-shaped.                                                                  |
| Append-only progress / multi-actor running log | `append_to_task_description` (combined ≤ 16384) | `text`             | Commutative, no CAS, server retries. Safe under concurrent writers.                                          |
| Diff, log, JSON dump, anything > a screen      | `add_task_attachment` (≤ 1 MB)                  | `body`             | `description` overflows at 16 KB. Set `content_type: "text/markdown" \| "text/plain" \| "application/json"`. |
| Field changes (title, labels, priority)        | `update_task` with `expected_version`           | n/a                | This is the only mutation that needs CAS for the change itself.                                              |

**Don't dump diffs into `description`.** It will be truncated and you will lose the report. Always pick `add_task_attachment` for artifacts.

## Dispatching subagents

You are usually a Claude Code orchestrator. Don't try to invoke a worker via MCP — there's no `spawn_agent` tool. Use the **Agent tool** to spawn a Claude Code subagent and brief it. Each subagent runs in its own context and uses the same Kanban MCP connection.

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

Report back to me with: task_id, final column, final version, attachment ids.
```

Spawn one Agent call per worker — you can run them in parallel. Don't share a claim across subagents; each subagent has its own task.

## Watching the board (long-poll)

Don't loop `list_tasks` every second. Use `wait_for_board_events`:

```json
{"tool": "wait_for_board_events",
 "args": {"board": "web-redesign", "since_ts": <last>, "timeout_ms": 15000}}
```

- First call: omit `since_ts` to start from "now".
- Every subsequent call: pass back `next_since_ts` from the last response. Same value de-dupes.
- `timeout_ms` cap is **25 000**. Pick 10–20 s to stay well under request budget.
- Returns immediately if events newer than `since_ts` are already buffered (last 200/board).

Default rate limit is 60 req/min/key. A long-poll loop at `timeout_ms=15000` ≈ 4 req/min when idle, leaving plenty of budget for mutations. If you must `list_tasks`, do it once on startup, then rely on events.

## Race & error recovery

| Code                | What it means                                                                                | Action                                                                                                                                             |
| ------------------- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `VERSION_CONFLICT`  | Another actor mutated this task since you read it. Latest task is in `details`.              | `get_task`, decide if intent still valid, retry once with fresh version. After 2 conflicts, comment + stop.                                        |
| `LOCKED_BY_OTHER`   | Someone else holds the claim.                                                                | **Do not retry.** Pick another task or end the session. Claim auto-expires after TTL — `wait_for_board_events` will tell you.                      |
| `RATE_LIMITED`      | 60 req/min exceeded. `Retry-After` header set.                                               | Exponential back-off with jitter, starting ~2 s, max ~30 s. Drop reads (re-fetches) before mutations; preserve the watcher and final move/release. |
| `VALIDATION_FAILED` | Bad args (missing `reason`, `agent_name`, wrong field name, out-of-range `timeout_ms`, etc.) | Don't retry — fix the call.                                                                                                                        |
| `NOT_FOUND`         | Task / board doesn't exist or your key is scoped to a different workspace.                   | Stop. Don't keep guessing IDs.                                                                                                                     |
| `FORBIDDEN`         | Workspace-scoped key, wrong workspace.                                                       | Surface to user; you can't recover.                                                                                                                |
| `UNAUTHORIZED`      | Bad/expired API key.                                                                         | Surface to user.                                                                                                                                   |

**Claim about to expire while you're still working?** Call `extend_claim` ~2 min before TTL. Prefer `until_iso` (idempotent: server takes `max(current_expiry, until)`). If the claim already expired, `claim_task` it again — but check for `LOCKED_BY_OTHER` first; someone may have grabbed it.

**Stuck claim from a dead peer?** Don't `force_release_task` peer claims unilaterally — that's an orchestrator/human authority. As a worker, comment the situation and stop. As an orchestrator with workspace ownership, `force_release_task` with a clear `reason` (audited).

## assign_task vs claim_task

Both put a name on a task. They are not the same thing.

|                    | `assign_task`                                     | `claim_task`                                      |
| ------------------ | ------------------------------------------------- | ------------------------------------------------- |
| Semantics          | **Permanent ownership** ("worker-fe owns this")   | **Exclusive lease** ("I'm working on this _now_") |
| TTL                | None — sticky until reassigned                    | 30 min default, 8h max, auto-expires              |
| Exclusive?         | No — multiple agents can act on it                | Yes — others get `LOCKED_BY_OTHER`                |
| Used by            | **Orchestrator** assigning work to a named worker | **Worker** locking a task while it works          |
| `expected_version` | Optional (omit for last-writer-wins)              | Required                                          |

Orchestrator dispatches: `assign_task(assignee_name="worker-fe")` then dispatches the subagent. Worker on pickup: `claim_task` with TTL. Both can coexist on the same task.

You can do both atomically: `move_task(..., assign_to="worker-fe")` moves and assigns in one call. Use this when triaging Backlog → Ready: move + assign so the next agent sees a single consistent state.

## Self-check before each mutation

Run through this list mentally — every item that bites you has happened in the wild:

- [ ] Did I include `reason` (creates, deletes, force-releases)?
- [ ] Did I include `expected_version` if the tool requires it?
- [ ] Am I passing `agent_name` or is `X-Agent-Name` set in headers?
- [ ] Am I using `task_id` (not `id`), `board` (not `slug`), `to_column` (not `column_id`), `ttl_minutes` (not `ttl_seconds`), `timeout_ms` (not `timeout_seconds`)?
- [ ] If sending a report > 1 paragraph, am I using `add_task_attachment` instead of stuffing it into `description`?
- [ ] Did I read the latest `version` from my previous response, not compute `v+1`?

## Common Mistakes

| Mistake                                                                        | Reality                                                                                                                                                       |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "I'll skip `reason` to keep the call short"                                    | `create_task` / `delete_task` / `force_release_task` reject without it.                                                                                       |
| "I'll compute `v+1` myself"                                                    | Other actors increment too. Always read the latest `version` from the server response.                                                                        |
| "Long-poll every second to be responsive"                                      | Burns rate limit. `wait_for_board_events` already returns immediately when events exist.                                                                      |
| "Put the diff in `description`"                                                | 16 KB cap. Use `add_task_attachment`.                                                                                                                         |
| "Pass `expected_version` to `add_task_comment` / `append_to_task_description`" | These are CAS-free. Server rejects unknown args; the lock you wanted doesn't exist (and isn't needed — they're commutative).                                  |
| "Use `body` for `append_to_task_description`"                                  | The field is `text`. `body` is for `add_task_comment` and `add_task_attachment`. Yes, it's inconsistent — that's why this row exists.                         |
| "Set per-task `column` inside the `bulk_create_tasks.tasks[]` array"           | Schema rejects unknown keys. There is one top-level `column` for the whole batch. To create across multiple columns, send multiple `bulk_create_tasks` calls. |
| "Retry `LOCKED_BY_OTHER` in a loop"                                            | The other holder has up to 8h. Pick another task. The watcher will tell you when it frees.                                                                    |
| "Use `claim_task` to assign work to worker-fe"                                 | That's `assign_task`. `claim_task` is for the worker doing it themselves.                                                                                     |
| "Spawn workers via an MCP tool"                                                | There isn't one. Use the Claude Code Agent tool to dispatch a subagent and hand it the `task_id`.                                                             |
| "Set `timeout_ms: 60000` for a longer poll"                                    | Capped at 25 000. Use 10 000–20 000 and just call again.                                                                                                      |
| "After `VERSION_CONFLICT`, retry blindly"                                      | Re-`get_task`, validate intent against new state, then retry. Two conflicts in a row = stop and comment.                                                      |
| "Skip `agent_name` because the header is probably set"                         | Verify once with `list_my_claims` (which uses your name). If empty when you expect claims, your name isn't set.                                               |

## Red Flags — STOP

- About to call a tool with `expected_version` set to a number you computed locally (not from a server response).
- About to dump > 2 KB of text into `description` or a comment body.
- About to `claim_task` a task an orchestrator already `assigned` to a different worker.
- About to retry `LOCKED_BY_OTHER`.
- About to call `wait_for_board_events` with `timeout_ms` > 25 000.
- Inside a `while True: list_tasks(...)` loop. Use the watcher.
- About to `force_release` a peer's claim without an explicit human go-ahead.
- About to send `body: "..."` to `append_to_task_description` (the field is `text`).
- About to put a `column` field inside one of the items in `bulk_create_tasks.tasks[]` (it goes at the top level, once).

## Quick reference (URLs and resources)

- Setup doc: see `https://docs.kanbots.ru/agents/setup` for the snippet your MCP client expects.
- Resources (read-only, useful for grounding): `kanban://workspaces`, `kanban://board/<slug>`, `kanban://task/<id>`.
- Default rate limit: 60 req/min/key. Configurable server-side via `RATE_LIMIT_MCP_RPM`.
- Claim TTL: 30 min default, 8 h max. Auto-expires.
- Description cap: 16 384 chars. Comment cap: 8 192. Attachment cap: 1 MB. Title cap: 200. Reason cap: 500.
