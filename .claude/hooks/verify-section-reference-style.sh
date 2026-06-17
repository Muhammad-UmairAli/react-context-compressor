#!/usr/bin/env bash
# Flag bare §N references (without the <file-stem> prefix) in commit messages,
# Issue bodies, and PR bodies. The kit's convention requires
# <file-stem> §<number> (<descriptor>) every time. See
# docs/methodology/01-orchestration-spine.md.
#
# This is a sample hook. Wire it into .claude/settings.json under PreToolUse if
# you want it enforced in this project.

set -euo pipefail

input=$(cat)

command=$(printf '%s' "$input" | python -c 'import json,sys; d=json.load(sys.stdin); print(d.get("tool_input",{}).get("command",""))' 2>/dev/null || echo "")

# Only inspect commands that produce user-visible text we want to govern.
case "$command" in
  *"git commit -m"* | *"gh pr create"* | *"gh issue create"* | *"gh pr edit"* | *"gh issue edit"*)
    # Look for bare § N where N is a number, NOT preceded by a known file stem.
    # Allowed: SPLIT-PLAN §5, methodology/03-github-workflow.md §2, etc.
    # Flagged: bare " §5 " or "§6" without preceding identifier-with-letter-or-dot.
    if printf '%s' "$command" | grep -qE '(^|[[:space:]])\xc2\xa7[0-9]'; then
      echo "WARN: Detected bare '§N' reference. The kit's convention is" >&2
      echo "      <file-stem> §<number> (<descriptor>) every time." >&2
      echo "      See docs/methodology/01-orchestration-spine.md and" >&2
      echo "      docs/conventions/section-references.md for descriptors." >&2
      # Soft-warn (exit 0). Set 'exit 2' here to make it a hard block.
      exit 0
    fi
    ;;
esac

exit 0
