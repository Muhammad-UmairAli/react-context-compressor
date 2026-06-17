#!/usr/bin/env bash
# Refuse `gh pr create` if the PR body lacks `Closes #N`.
# Enforces the consistency invariant: every PR auto-closes its linked Issue.
# Reads PreToolUse JSON payload from stdin; exits 2 to block.

set -euo pipefail

input=$(cat)

command=$(printf '%s' "$input" | python -c 'import json,sys; d=json.load(sys.stdin); print(d.get("tool_input",{}).get("command",""))' 2>/dev/null || echo "")

case "$command" in
  *"gh pr create"*)
    if ! printf '%s' "$command" | grep -qE 'Closes #[0-9]+'; then
      echo "BLOCKED: gh pr create body must include 'Closes #N' to auto-close the linked Issue." >&2
      echo "         If this PR has no Issue (small chore), add 'Closes #none' or open one first." >&2
      echo "         See docs/methodology/03-github-workflow.md." >&2
      exit 2
    fi
    ;;
esac

exit 0
