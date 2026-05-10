#!/usr/bin/env bash
# kanban-init.sh — interactive wizard that emits a Claude Code MCP config block.

set -u

prompt() {
    local var=$1
    local label=$2
    local default=${3:-}
    local val
    if [ -n "$default" ]; then
        read -r -p "$label [$default]: " val
        val=${val:-$default}
    else
        read -r -p "$label: " val
    fi
    printf -v "$var" "%s" "$val"
}

echo "Kanbots init wizard"
echo "==================="
prompt MCP_URL "MCP endpoint URL" "https://kanbots.ru/api/mcp"
prompt API_KEY "API key (paste; will be echoed back at the end)"
prompt AGENT_NAME "Agent name (e.g. orchestrator, worker-fe)"

cat <<JSON

# --- Add this to your Claude Code MCP config (.mcp.json or settings) ---
{
  "mcpServers": {
    "kanban": {
      "type": "http",
      "url": "$MCP_URL",
      "headers": {
        "Authorization": "Bearer $API_KEY",
        "X-Agent-Name": "$AGENT_NAME"
      }
    }
  }
}

# --- Or export these env vars before running CLI scripts ---
export KANBAN_MCP_URL="$MCP_URL"
export KANBAN_API_KEY="$API_KEY"
export KANBAN_AGENT_NAME="$AGENT_NAME"
JSON
