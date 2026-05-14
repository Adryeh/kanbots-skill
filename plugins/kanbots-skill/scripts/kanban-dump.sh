#!/usr/bin/env bash
# kanban-dump.sh <board-slug>
# Dump board state (tasks, claims, recent events) as JSON to stdout.

set -u

if [ $# -lt 1 ]; then
    echo "Usage: kanban-dump.sh <board-slug>" >&2
    exit 2
fi

: "${KANBAN_MCP_URL:?set KANBAN_MCP_URL}"
: "${KANBAN_API_KEY:?set KANBAN_API_KEY}"
: "${KANBAN_AGENT_NAME:?set KANBAN_AGENT_NAME}"

BOARD=$1

call() {
    local name=$1
    local args_json=$2
    curl -fsS --max-time 10 \
        -H 'Content-Type: application/json' \
        -H "Authorization: Bearer $KANBAN_API_KEY" \
        -H "X-Agent-Name: $KANBAN_AGENT_NAME" \
        -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"tools/call\",\"params\":{\"name\":\"$name\",\"arguments\":$args_json}}" \
        "$KANBAN_MCP_URL"
}

board_json=$(call get_board "{\"board\":\"$BOARD\"}")
tasks_json=$(call list_tasks "{\"board\":\"$BOARD\"}")
events_json=$(call wait_for_board_events "{\"board\":\"$BOARD\",\"timeout_ms\":0}")
claims_json=$(call list_my_claims "{}")

cat <<JSON
{
  "board": $board_json,
  "tasks": $tasks_json,
  "events": $events_json,
  "my_claims": $claims_json
}
JSON
