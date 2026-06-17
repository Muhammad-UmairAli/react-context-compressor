#!/usr/bin/env bash
# .claude/hooks/log-skill-on-invoke.sh
# PreToolUse hook — fires before every Skill tool call.
# Logs VoltAgent specialist invocations to AGENT-LOG.md.
# Non-VoltAgent skills (built-in slash commands) are ignored.
# Always exits 0 — never blocks the Skill call.

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

PAYLOAD="$(cat)"

SKILL_NAME="$(echo "$PAYLOAD" | $PYTHON -c "
import json, sys
d = json.load(sys.stdin)
ti = d.get('tool_input', {})
print(ti.get('skill', ''))
" 2>/dev/null || echo "")"

# Only log if it matches a VoltAgent agent (file exists in plugin cache).
VOLTAGENT_CACHE="$HOME/.claude/plugins/cache/voltagent-subagents"
if ! find "$VOLTAGENT_CACHE" -name "${SKILL_NAME}.md" 2>/dev/null | grep -q .; then
  exit 0
fi

DESCRIPTION="$(echo "$PAYLOAD" | $PYTHON -c "
import json, sys
d = json.load(sys.stdin)
ti = d.get('tool_input', {})
args = ti.get('args', '')
print(str(args)[:80].replace('|', '/') if args else 'no args')
" 2>/dev/null || echo "no args")"

PHASE="unknown"
STEP="unknown"
TIMER_FILE=".claude/task-timer.json"
if [ -f "$TIMER_FILE" ]; then
  KEY="$($PYTHON -c "
import json, sys
try:
    data = json.loads(open('$TIMER_FILE').read())
    keys = list(data.keys())
    print(keys[-1] if keys else 'unknown-unknown')
except Exception:
    print('unknown-unknown')
" 2>/dev/null || echo "unknown-unknown")"
  PHASE="${KEY%%-*}"
  STEP="${KEY##*-}"
fi

$PYTHON tools/log-agent.py \
  "$PHASE" "$STEP" "VoltAgent" "$SKILL_NAME" "n" \
  "$DESCRIPTION" 2>/dev/null || true

exit 0
