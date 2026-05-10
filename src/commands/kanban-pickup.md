---
description: Find and start working on the next available task on a Kanbots board.
argument-hint: "[board-slug]"
---

# /kanban-pickup

Pick a task to work on right now.

## What you do, in order

1. Resolve the board slug. If `$1` is provided, use it. Otherwise, call `list_boards` and prompt the user to choose.
2. Identify candidates, in this priority order:
   - Tasks claimed by `KANBAN_AGENT_NAME` with TTL > 0 (resume what's mine).
   - Tasks `assigned_to == KANBAN_AGENT_NAME` and not currently claimed.
   - Tasks in the `Ready` (or first non-Backlog) column with no assignee and no claim.
3. If multiple candidates remain, list them with `task_id`, `title`, and column, and ask the user which to take. Default to the first.
4. `get_task(task_id)` → read `version`.
5. `claim_task(task_id, expected_version=<v>, ttl_minutes=30)`.
6. `move_task(task_id, to_column="In Progress", expected_version=<new v>)`.
7. Print the task title, link, current `version`, and the time the claim expires.

## Errors

- `LOCKED_BY_OTHER` on step 5 → drop the candidate, return to step 2 with that task excluded.
- `VERSION_CONFLICT` on step 5 or 6 → re-`get_task` once, retry once. After two failures, comment on the task and abort.

## When NOT to use

If the user already has open claims and you can resume them, just resume — don't create new claims.
