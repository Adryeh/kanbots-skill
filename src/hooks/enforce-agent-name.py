#!/usr/bin/env python3
"""PreToolUse hook for mcp__kanban__.* — block mutations when no agent name is configured.

Stdin (JSON, Claude Code hook contract):
    {
      "tool_name": "mcp__kanban__create_task",
      "tool_input": { ... }
    }

Outputs JSON to stdout. Non-zero exit blocks the tool call (Claude Code convention).
"""
import json
import os
import sys

MUTATING_TOOLS_HINT = (
    "Set KANBAN_AGENT_NAME in your environment, or configure X-Agent-Name in your "
    "MCP client headers, or pass agent_name=... on this call."
)


def main():
    try:
        payload = json.load(sys.stdin)
    except Exception:
        # If stdin is not parseable, do not block.
        sys.exit(0)

    tool_name = payload.get("tool_name", "")
    tool_input = payload.get("tool_input") or {}

    # Only enforce on kanban tools.
    if not tool_name.startswith("mcp__kanban__"):
        sys.exit(0)

    # Read-only tools don't require agent_name.
    READ_ONLY = {
        "mcp__kanban__list_workspaces",
        "mcp__kanban__list_boards",
        "mcp__kanban__get_board",
        "mcp__kanban__list_tasks",
        "mcp__kanban__get_task",
        "mcp__kanban__list_task_comments",
        "mcp__kanban__list_task_attachments",
        "mcp__kanban__get_task_attachment",
        "mcp__kanban__list_my_claims",
        "mcp__kanban__wait_for_board_events",
    }
    if tool_name in READ_ONLY:
        sys.exit(0)

    has_per_call = bool(tool_input.get("agent_name"))
    has_env = bool(os.environ.get("KANBAN_AGENT_NAME"))

    if has_per_call or has_env:
        sys.exit(0)

    print(
        json.dumps({
            "permissionDecision": "deny",
            "permissionDecisionReason": (
                f"agent_name not set for {tool_name}. {MUTATING_TOOLS_HINT}"
            ),
        })
    )
    sys.exit(2)


if __name__ == "__main__":
    main()
