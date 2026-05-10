#!/usr/bin/env bash
# kanban-doctor.sh — verify your Kanbots client setup.
# Usage: KANBAN_MCP_URL=... KANBAN_API_KEY=... KANBAN_AGENT_NAME=... ./kanban-doctor.sh

set -u

red() { printf "\033[31m%s\033[0m" "$1"; }
green() { printf "\033[32m%s\033[0m" "$1"; }
yellow() { printf "\033[33m%s\033[0m" "$1"; }

ok=0
fail=0

check() {
    local label=$1
    local cmd=$2
    printf "  %-40s ... " "$label"
    if eval "$cmd" >/dev/null 2>&1; then
        echo "$(green OK)"
        ok=$((ok + 1))
    else
        echo "$(red FAIL)"
        fail=$((fail + 1))
    fi
}

require_env() {
    local name=$1
    printf "  %-40s ... " "env: $name"
    if [ -n "${!name:-}" ]; then
        echo "$(green set)"
        ok=$((ok + 1))
    else
        echo "$(red unset)"
        fail=$((fail + 1))
    fi
}

echo "Kanbots doctor"
echo "=============="
require_env KANBAN_MCP_URL
require_env KANBAN_API_KEY
require_env KANBAN_AGENT_NAME

if [ -n "${KANBAN_MCP_URL:-}" ]; then
    check "MCP endpoint reachable" "curl -fsS --max-time 5 -H 'Content-Type: application/json' -H 'Authorization: Bearer ${KANBAN_API_KEY:-}' -d '{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"tools/list\",\"params\":{}}' \"$KANBAN_MCP_URL\""
    check "list_workspaces succeeds" "curl -fsS --max-time 5 -H 'Content-Type: application/json' -H 'Authorization: Bearer ${KANBAN_API_KEY:-}' -H 'X-Agent-Name: ${KANBAN_AGENT_NAME:-anon}' -d '{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"tools/call\",\"params\":{\"name\":\"list_workspaces\",\"arguments\":{}}}' \"$KANBAN_MCP_URL\""
fi

echo ""
echo "Summary: $(green "$ok ok"), $(red "$fail fail")"
[ $fail -eq 0 ]
