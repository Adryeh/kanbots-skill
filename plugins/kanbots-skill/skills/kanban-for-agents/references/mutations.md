---
description: >-
  Mutation rules — which tools need expected_version, which need reason, and the
  argument names that bite.
---

# Mutations

## Tool table

| Tool                                             | `expected_version`                                 | `reason`                | Notes                                                                                                                    |
| ------------------------------------------------ | -------------------------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `create_task`, `bulk_create_tasks`               | n/a                                                | **required**            | `reason` ≤ 500 chars. Title ≤ 200, description ≤ 16 384.                                                                 |
| `update_task`                                    | **required** (positive int)                        | —                       | Re-read on `VERSION_CONFLICT`.                                                                                           |
| `claim_task`, `release_task`                     | **required**                                       | —                       | Default TTL 30 min, max 480 (8 h).                                                                                       |
| `extend_claim`                                   | **required**                                       | —                       | Pass `until_iso` (idempotent) OR `ttl_minutes` (additive). Use `until_iso` if multiple actors might extend.              |
| `delete_task`                                    | **required**                                       | **required**            | Audited. Soft-deletes via audit log.                                                                                     |
| `move_task`, `bulk_move_tasks`, `assign_task`    | **optional** (omit or `null` for last-writer-wins) | optional                | Pass a positive int if you want CAS; omit for orchestration writes you don't want failing on contention.                 |
| `force_release_task`                             | n/a                                                | **required**            | Workspace-owner authority — recovering a dead worker.                                                                    |
| `add_task_comment`, `append_to_task_description` | n/a                                                | —                       | Commutative. Server retries on conflict. **Don't send `expected_version`.**                                              |
| `add_task_attachment`, `delete_task_attachment`  | n/a                                                | `reason` only on delete | `body` ≤ 1 MB, max 50 attachments/task.                                                                                  |

## Argument names that bite (real → wrong)

- `task_id` — not `id`
- `board` — not `slug` / `board_slug`
- `to_column` — not `column_id`. Accepts the column **name** ("Done") or its id.
- `column` (in `list_tasks` filter, and as a **top-level** field on `bulk_create_tasks`) — accepts name or id. **`bulk_create_tasks` has ONE `column` for the whole call**: every task in the batch lands in the same column. There is no per-item `column` field; per-item only `title` / `description` / `priority` / `labels` are accepted.
- `ttl_minutes` — not `ttl_seconds`. Min 1, max 480.
- `since_ts` — Unix-ms epoch. Pass back `next_since_ts` from the previous response.
- `timeout_ms` — max **25 000**. Larger values are rejected.
- `expected_version` — positive int, never zero, never negative.

## `body` vs `text`

| Tool                         | Field name | Cap                                       |
| ---------------------------- | ---------- | ----------------------------------------- |
| `add_task_comment`           | `body`     | 8 192 chars                               |
| `append_to_task_description` | `text`     | 16 384 chars (combined description)       |
| `add_task_attachment`        | `body`     | 1 000 000 chars (≤ 1 MB)                  |

Comments and attachments take `body`; description-append takes `text`. Confusing them returns `VALIDATION_FAILED`.
