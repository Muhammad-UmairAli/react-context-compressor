#!/usr/bin/env bash
# .claude/hooks/log-agent-on-complete.sh
# PostToolUse hook — fires after every Agent tool call completes.
# Pops the most recent in-flight entry and writes duration_ms to agents-log.
# Always exits 0 — never blocks.

set -euo pipefail

# Resolve Python interpreter: python3 (Linux/Mac) → py (Windows launcher) → python
if python3 -c "import sys" 2>/dev/null; then
  PYTHON=python3
elif py -c "import sys" 2>/dev/null; then
  PYTHON=py
elif python -c "import sys" 2>/dev/null; then
  PYTHON=python
else
  exit 0
fi

$PYTHON tools/log-agent.py --complete 2>/dev/null || true

exit 0
