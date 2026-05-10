---
description: Read-only summary of my claims, my tasks, and recent board events.
argument-hint: "[board-slug]"
---

# /kanban-status

Print a status snapshot. Read-only — no mutations.

## What you do

1. Resolve board slug from `$1` or default workspace board.
2. `list_my_claims()` — show: `task_id`, title, column, claim TTL remaining, `version`.
3. `list_tasks(board, filters={assignee: KANBAN_AGENT_NAME})` — my open assignments, grouped by column.
4. `wait_for_board_events(board, timeout_ms=0)` — fetch buffered events without waiting; show last 10 entries.
5. Print a 4-section summary (claims, assignments, recent events, board metadata).

## Output format

```
== My claims (3) ==
TASK-12   "...title..."   In Progress   23m left   v=14
...

== Assigned to me, unclaimed (1) ==
TASK-19   "...title..."   Ready

== Recent events (last 10) ==
2026-05-10T11:42Z  TASK-19  moved to Ready by orchestrator
...

== Board ==
slug=web-redesign  columns=[Backlog, Ready, In Progress, Done]  rate=60/min
```

## Errors

`RATE_LIMITED` → back off and retry once. Anything else → surface and stop.
