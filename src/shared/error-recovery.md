---
description: Mini error-recovery cheatsheet for sub-agents.
---

## Error recovery quick reference

- **VERSION_CONFLICT**: `get_task` again, decide if your intent still applies, retry once. Two in a row → comment, stop.
- **LOCKED_BY_OTHER**: stop. Do not retry. Comment and exit.
- **RATE_LIMITED**: back off ~2 s → ~30 s with jitter. Drop reads first; keep the final move / release.
- **VALIDATION_FAILED**: do not retry. Fix the call.

If you don't know which one applies, read [errors](references/errors.md).
