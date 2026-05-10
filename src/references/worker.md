---
description: Worker workflow — claiming a single task, mutating it, reporting, releasing.
---

# Worker workflow

## Loop

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

## Re-reading `version`

After every successful mutation, the server returns the new task with a new `version`. Use **that** number on the next mutation. Never compute `v+1` locally — between your read and your write, another actor (a parallel comment, a sibling worker's append) may have bumped the counter.

## `extend_claim`

If you are still working as TTL approaches, call `extend_claim` ~2 min before expiry. Two flavours:

- `until_iso="2026-05-10T12:00:00Z"` — idempotent set-deadline. Server takes `max(current, until)`. Prefer this if multiple actors might extend.
- `ttl_minutes=30` — additive. Adds the given minutes to the current expiry.

If your claim already expired, `claim_task` again — but check `LOCKED_BY_OTHER` first; someone may have grabbed it.

## What to do on errors

- **VERSION_CONFLICT**: `get_task`, decide if your intent still applies, retry once with the fresh `version`. Two conflicts in a row → comment what happened and stop.
- **LOCKED_BY_OTHER**: stop. Do not poll. Comment and exit; the orchestrator's watcher will notice.
- **RATE_LIMITED**: exponential back-off with jitter, ~2 s → ~30 s. Drop redundant reads first; preserve the watcher and the final move/release.
- Full table: [errors](errors.md).

## Reporting output

Pick the right tool by volume:

- 1–2 sentences ("done; tests green") → `add_task_comment(body=...)`.
- Append-only progress / multi-actor running log → `append_to_task_description(text=...)`.
- Diff, log, JSON dump, anything > a screen → `add_task_attachment(body=..., content_type=...)`.

Details and field-name traps: [reports](reports.md).

<!-- include: shared/self-check.md -->
