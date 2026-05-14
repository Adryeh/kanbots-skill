#!/usr/bin/env python3
"""PreToolUse hook — catch common arg typos before they hit the server.

Detected:
- `id` instead of `task_id`
- `slug` instead of `board`
- `column_id` instead of `to_column`
- `body` field on append_to_task_description (should be `text`)
- `ttl_seconds` instead of `ttl_minutes`
- `timeout_seconds` instead of `timeout_ms`
"""
import json
import sys

CHECKS = [
    ("id", "task_id is the correct argument; `id` is rejected"),
    ("slug", "board is the correct argument; `slug` / `board_slug` is rejected"),
    ("column_id", "to_column is the correct argument and accepts column name or id"),
    ("ttl_seconds", "ttl_minutes is the correct argument (1–480)"),
    ("timeout_seconds", "timeout_ms is the correct argument (≤ 25000)"),
]


def main():
    try:
        payload = json.load(sys.stdin)
    except Exception:
        sys.exit(0)

    tool_name = payload.get("tool_name", "")
    if not tool_name.startswith("mcp__kanban__"):
        sys.exit(0)

    args = payload.get("tool_input") or {}
    issues = []

    for bad, hint in CHECKS:
        if bad in args:
            issues.append(f"`{bad}` looks wrong: {hint}")

    if tool_name == "mcp__kanban__append_to_task_description" and "body" in args:
        issues.append("`body` is wrong for append_to_task_description — use `text`")

    if not issues:
        sys.exit(0)

    print(json.dumps({
        "permissionDecision": "deny",
        "permissionDecisionReason": "; ".join(issues),
    }))
    sys.exit(2)


if __name__ == "__main__":
    main()
