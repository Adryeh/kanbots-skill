#!/usr/bin/env python3
"""PreToolUse hook for mcp__kanban__.* — opportunistically extend a near-expiry claim.

Non-blocking: if the extend call fails or env is incomplete, the hook exits 0
without blocking the underlying tool call.
"""
import json
import os
import sys
import urllib.request
import urllib.error
from datetime import datetime, timezone, timedelta

MIN_REMAINING_SECONDS = 5 * 60
EXTEND_BY_MINUTES = 30


def http_post(url, headers, payload):
    body = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=body, method="POST", headers=headers)
    with urllib.request.urlopen(req, timeout=5) as r:
        return json.loads(r.read())


def jsonrpc(url, headers, method, params):
    return http_post(url, headers, {
        "jsonrpc": "2.0",
        "id": 1,
        "method": method,
        "params": params,
    })


def main():
    try:
        payload = json.load(sys.stdin)
    except Exception:
        sys.exit(0)

    tool_name = payload.get("tool_name", "")
    if not tool_name.startswith("mcp__kanban__"):
        sys.exit(0)

    url = os.environ.get("KANBAN_MCP_URL")
    api_key = os.environ.get("KANBAN_API_KEY")
    agent_name = os.environ.get("KANBAN_AGENT_NAME")
    if not (url and api_key and agent_name):
        sys.exit(0)

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}",
        "X-Agent-Name": agent_name,
    }

    try:
        claims_resp = jsonrpc(url, headers, "tools/call", {
            "name": "list_my_claims",
            "arguments": {},
        })
    except (urllib.error.URLError, TimeoutError, ValueError):
        sys.exit(0)

    claims = (claims_resp.get("result") or {}).get("claims") or []
    now = datetime.now(timezone.utc)
    extend_until = (now + timedelta(minutes=EXTEND_BY_MINUTES)).isoformat()

    for c in claims:
        expires = c.get("expires_at")
        version = c.get("version")
        task_id = c.get("task_id")
        if not (expires and version and task_id):
            continue
        try:
            expires_dt = datetime.fromisoformat(expires.replace("Z", "+00:00"))
        except ValueError:
            continue
        remaining = (expires_dt - now).total_seconds()
        if remaining < MIN_REMAINING_SECONDS:
            try:
                jsonrpc(url, headers, "tools/call", {
                    "name": "extend_claim",
                    "arguments": {
                        "task_id": task_id,
                        "expected_version": version,
                        "until_iso": extend_until,
                    },
                })
            except (urllib.error.URLError, TimeoutError, ValueError):
                pass  # non-blocking

    sys.exit(0)


if __name__ == "__main__":
    main()
