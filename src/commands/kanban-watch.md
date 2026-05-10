---
description: Long-running board watch loop with structured response on events.
argument-hint: "<board-slug>"
---

# /kanban-watch

Run a foreground `wait_for_board_events` loop and react to events.

## Setup

1. Validate `$1` (board slug). If missing, abort with usage.
2. `since_ts = null` for the first call.
3. Print `Watching <board>. Press Ctrl-C to stop.`

## Loop

```
while not interrupted:
    resp = wait_for_board_events(board=$1, since_ts=since_ts, timeout_ms=15000)
    since_ts = resp.next_since_ts
    for event in resp.events:
        handle(event)
```

## Reactions

- **task moved to Done with parent_id** — `get_task(parent_id)`, if all siblings are Done then `move_task(parent, "Done")`. Otherwise, comment "child <id> Done; siblings still open".
- **new task in Backlog** — print `[backlog] TASK-<id> "<title>"` and pause. Ask the user if they want to triage now.
- **claim.expired** — print `[expired] TASK-<id> by <prev-claimant>`. Pause and ask whether to reassign.

Do not auto-mutate without confirming with the user. Reactions are *suggestions*, not silent actions.

## On cancellation

Print the last `since_ts` and the loop exits. Resume with the same value: `/kanban-watch <board> --since <since_ts>` (the `--since` flag is honoured by the next invocation when you wire it up; for now, the printed `since_ts` is enough for the user to manually feed back).

## Errors

- `RATE_LIMITED` → back off and retry; do not exit the loop.
- `NOT_FOUND` / `FORBIDDEN` → print and exit.
