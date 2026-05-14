#!/usr/bin/env python3
"""Stop hook — when a session ends with open claims, post a brief context comment per task.

Non-blocking. Best-effort. Releases nothing.
"""
import json
import os
import sys
import urllib.request
import urllib.error

LAST_CONTEXT_CHARS = 240


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

    last_text = (payload.get("transcript") or {}).get("last_assistant_text") or ""
    snippet = last_text.strip()[:LAST_CONTEXT_CHARS] or "(no recent context)"

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
    for c in claims:
        task_id = c.get("task_id")
        if not task_id:
            continue
        body = f"session paused by {agent_name}. last context: {snippet}"
        try:
            jsonrpc(url, headers, "tools/call", {
                "name": "add_task_comment",
                "arguments": {"task_id": task_id, "body": body},
            })
        except (urllib.error.URLError, TimeoutError, ValueError):
            pass  # non-blocking

    sys.exit(0)


if __name__ == "__main__":
    main()
