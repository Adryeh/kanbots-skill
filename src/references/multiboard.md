---
description: Working with multiple boards or workspaces — discovery, columnId caching, and cross-board hand-offs.
---

# Multiboard

## Discovery

```
list_workspaces()                  → list of workspaces this key can see
list_boards(workspace=<id|slug>)   → boards in a workspace
get_board(board=<slug>)            → columns and metadata for one board
```

Cache `columnIds` per board for the session. Column IDs are stable; column names can be edited by humans.

## Cross-board orchestration

If your project spans more than one board (e.g. `frontend` and `backend`):

- Pin the slug everywhere. Each `list_tasks`, `claim_task`, `wait_for_board_events` call must specify which board.
- Run **one watcher per board** with separate `since_ts` cursors. The watcher is per-board.
- Don't fan out a single `bulk_create_tasks` across boards — it accepts one `board` per call.
- For dependencies that cross boards (a backend task blocked by a frontend task), encode the link in the description: `blocked-by: frontend#TASK-123`. There is no first-class cross-board link tool.

## Choosing where new work lands

When triaging a generic backlog:

1. Read the parent task's labels (`area:frontend`, `area:backend`).
2. Map labels to board slugs in your config (or hard-code if you only have two boards).
3. `bulk_create_tasks(board=<resolved>, column="Backlog", reason=..., tasks=[...])`.

If you cannot determine the board, leave the parent in `Backlog` of the originating board with a comment `triage: ambiguous; needs human routing`.

## Workspace-scoped keys

A key may be scoped to a single workspace. `list_workspaces` returns only what your key can see. If you expect more, ask the user; you cannot widen the scope from inside the agent.
