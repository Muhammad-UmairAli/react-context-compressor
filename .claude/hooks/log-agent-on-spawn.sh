#!/usr/bin/env bash
# .claude/hooks/log-agent-on-spawn.sh
# PreToolUse hook — fires before every Agent tool call.
# Extracts agent metadata from the tool_input JSON and calls log-agent.py.
# Always exits 0 so the Agent tool call is never blocked.

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

SUBAGENT_TYPE="$(echo "$PAYLOAD" | $PYTHON -c "
import json, sys
d = json.load(sys.stdin)
ti = d.get('tool_input', {})
print(ti.get('subagent_type', 'general-purpose'))
" 2>/dev/null || echo "general-purpose")"

DESCRIPTION="$(echo "$PAYLOAD" | $PYTHON -c "
import json, sys
d = json.load(sys.stdin)
ti = d.get('tool_input', {})
desc = ti.get('description', '')
print(desc[:80].replace('|', '/') if desc else 'no description')
" 2>/dev/null || echo "no description")"

RUN_IN_BG="$(echo "$PAYLOAD" | $PYTHON -c "
import json, sys
d = json.load(sys.stdin)
ti = d.get('tool_input', {})
print('y' if ti.get('run_in_background', False) else 'n')
" 2>/dev/null || echo "n")"

# Classify framework.
# Claude builtins are the fixed set of native Claude Code agent types.
# VoltAgent: namespaced types (voltagent-*) or plugin:name form, plus cache lookup.
# Anything else is custom.
case "$SUBAGENT_TYPE" in
  Explore|general-purpose|Plan|claude-code-guide|statusline-setup)
    FRAMEWORK="Claude"
    ;;
  voltagent-*|*:*)
    FRAMEWORK="VoltAgent"
    ;;
  *)
    VOLTAGENT_CACHE="$HOME/.claude/plugins/cache/voltagent-subagents"
    if find "$VOLTAGENT_CACHE" -name "${SUBAGENT_TYPE}.md" 2>/dev/null | grep -q .; then
      FRAMEWORK="VoltAgent"
    elif [ -f ".claude/project-shortname" ]; then
      FRAMEWORK="$(cat .claude/project-shortname | tr -d '[:space:]')"
    else
      FRAMEWORK="custom"
    fi
    ;;
esac

PHASE=""
STEP=""
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
  "$PHASE" "$STEP" "$FRAMEWORK" "$SUBAGENT_TYPE" "$RUN_IN_BG" \
  "$DESCRIPTION" 2>/dev/null || true

exit 0
