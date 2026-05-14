---
description: >-
  How to attach output to a task — comments vs append_to_task_description vs
  attachments.
---

# Reports

## Pick by volume

| Volume                                         | Use                                              | Field for the text | Why                                                                                                          |
| ---------------------------------------------- | ------------------------------------------------ | ------------------ | ------------------------------------------------------------------------------------------------------------ |
| 1–2 sentences ("done; tests green")            | `add_task_comment` (≤ 8 192 chars)               | `body`             | Audit-trail entry, no CAS, dialogue-shaped.                                                                  |
| Append-only progress / multi-actor running log | `append_to_task_description` (combined ≤ 16 384) | `text`             | Commutative, no CAS, server retries. Safe under concurrent writers.                                          |
| Diff, log, JSON dump, anything > a screen      | `add_task_attachment` (≤ 1 MB)                   | `body`             | `description` overflows at 16 KB. Set `content_type: "text/markdown" \| "text/plain" \| "application/json"`. |
| Field changes (title, labels, priority)        | `update_task` with `expected_version`            | n/a                | This is the only mutation that needs CAS for the change itself.                                              |

**Don't dump diffs into `description`.** It is truncated and you lose the report. Always pick `add_task_attachment` for artefacts.
