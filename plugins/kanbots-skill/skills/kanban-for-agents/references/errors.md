---
description: >-
  Full error-code table, recovery strategies, and the long list of common
  mistakes.
---

# Errors and recovery

## Error code table

| Code                | Meaning                                                                                          | Action                                                                                                                                             |
| ------------------- | ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `VERSION_CONFLICT`  | Another actor mutated this task since you read it. Latest task is in `details`.                  | `get_task`, decide if intent still valid, retry once with fresh version. After 2 conflicts, comment + stop.                                        |
| `LOCKED_BY_OTHER`   | Someone else holds the claim.                                                                    | **Do not retry.** Pick another task or end. Claim auto-expires after TTL — `wait_for_board_events` will tell you.                                  |
| `RATE_LIMITED`      | 60 req/min exceeded. `Retry-After` header set.                                                   | Exponential back-off with jitter, ~2 s → ~30 s. Drop reads first; preserve the watcher and final move/release.                                     |
| `VALIDATION_FAILED` | Bad args (missing `reason`, `agent_name`, wrong field name, out-of-range `timeout_ms`, etc.)     | Don't retry — fix the call.                                                                                                                        |
| `NOT_FOUND`         | Task / board doesn't exist or your key is scoped to a different workspace.                       | Stop. Don't keep guessing IDs.                                                                                                                     |
| `FORBIDDEN`         | Workspace-scoped key, wrong workspace.                                                           | Surface to user; you can't recover.                                                                                                                |
| `UNAUTHORIZED`      | Bad/expired API key.                                                                             | Surface to user.                                                                                                                                   |

## Stuck claim from a dead peer

Don't `force_release_task` peer claims unilaterally — that's an orchestrator/human authority. As a worker, comment the situation and stop. As an orchestrator with workspace ownership, `force_release_task` with a clear `reason` (audited).

## Common mistakes

| Mistake                                                                        | Reality                                                                                                                                                       |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "I'll skip `reason` to keep the call short"                                    | `create_task` / `delete_task` / `force_release_task` reject without it.                                                                                       |
| "I'll compute `v+1` myself"                                                    | Other actors increment too. Always read the latest `version` from the server response.                                                                        |
| "Long-poll every second to be responsive"                                      | Burns rate limit. `wait_for_board_events` already returns immediately when events exist.                                                                      |
| "Put the diff in `description`"                                                | 16 KB cap. Use `add_task_attachment`.                                                                                                                         |
| "Pass `expected_version` to `add_task_comment` / `append_to_task_description`" | These are CAS-free. Server rejects unknown args; the lock you wanted doesn't exist (and isn't needed — they're commutative).                                  |
| "Use `body` for `append_to_task_description`"                                  | The field is `text`. `body` is for `add_task_comment` and `add_task_attachment`.                                                                              |
| "Set per-task `column` inside the `bulk_create_tasks.tasks[]` array"           | Schema rejects unknown keys. There is one top-level `column` for the whole batch. To create across multiple columns, send multiple `bulk_create_tasks` calls. |
| "Retry `LOCKED_BY_OTHER` in a loop"                                            | The other holder has up to 8 h. Pick another task. The watcher will tell you when it frees.                                                                   |
| "Use `claim_task` to assign work to worker-fe"                                 | That's `assign_task`. `claim_task` is for the worker doing it themselves.                                                                                     |
| "Spawn workers via an MCP tool"                                                | There isn't one. Use the Claude Code Agent tool to dispatch a subagent and hand it the `task_id`.                                                             |
| "Set `timeout_ms: 60000` for a longer poll"                                    | Capped at 25 000. Use 10 000–20 000 and call again.                                                                                                           |
| "After `VERSION_CONFLICT`, retry blindly"                                      | Re-`get_task`, validate intent against new state, then retry. Two conflicts in a row = stop and comment.                                                      |
| "Skip `agent_name` because the header is probably set"                         | Verify once with `list_my_claims` (which uses your name). If empty when you expect claims, your name isn't set.                                               |
