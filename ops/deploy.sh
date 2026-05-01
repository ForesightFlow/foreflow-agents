#!/usr/bin/env bash
# Start all five foreflow agents in the background.
# Logs are written to logs/<agent>.log.
# Default: dry-run (no on-chain transactions). Pass --live to broadcast.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="$ROOT/logs"
LIVE_FLAG="${1:-}"

mkdir -p "$LOG_DIR"

cd "$ROOT"

if [[ ! -d dist ]]; then
  echo "dist/ not found — running npm run build first"
  npm run build
fi

pids=()

start_agent() {
  local name="$1"
  local entry="$2"
  local log="$LOG_DIR/${name}.log"
  echo "Starting $name  (log: $log)"
  # shellcheck disable=SC2086
  node "$ROOT/dist/$entry" $LIVE_FLAG >> "$log" 2>&1 &
  pids+=($!)
  echo "  PID=$!"
}

start_agent "foreflow-ensemble"     "agents/foreflow-ensemble/agent.js"
start_agent "foreflow-debate"       "agents/foreflow-debate/agent.js"
start_agent "foreflow-orchestrator" "agents/foreflow-orchestrator/agent.js"
start_agent "foreflow-pipeline"     "agents/foreflow-pipeline/agent.js"
start_agent "foreflow-consensus"    "agents/foreflow-consensus/agent.js"

echo ""
echo "All agents started.  PIDs: ${pids[*]}"
echo "To follow logs:  tail -f $LOG_DIR/*.log"
echo "To stop all  :  kill ${pids[*]}"
