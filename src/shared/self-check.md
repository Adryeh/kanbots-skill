---
description: Self-check checklist included into skill.md and agent profiles.
---

## Self-check before each mutation

- [ ] Did I include `reason` (creates, deletes, force-releases)?
- [ ] Did I include `expected_version` if the tool requires it?
- [ ] Am I passing `agent_name`, or is `X-Agent-Name` set in headers?
- [ ] Am I using `task_id` (not `id`), `board` (not `slug`), `to_column` (not `column_id`), `ttl_minutes` (not `ttl_seconds`), `timeout_ms` (not `timeout_seconds`)?
- [ ] If sending a report > 1 paragraph, am I using `add_task_attachment` instead of stuffing it into `description`?
- [ ] Did I read the latest `version` from my previous response, not compute `v+1`?
