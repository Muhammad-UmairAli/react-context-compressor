#!/usr/bin/env bash
# Warn when `git commit` succeeds but TIME-LOG.md was not modified in the
# committed changeset. Doesn't block — fires a stderr warning so Claude
# knows to invoke /log-time before the next commit if substantive work
# happened.
#
# Reads PostToolUse JSON payload from stdin; exits 0 always (warning, not
# block).
#
# See docs/methodology/02-time-tracking-and-estimates.md.

set -euo pipefail

input=$(cat)

command=$(printf '%s' "$input" | python -c 'import json,sys; d=json.load(sys.stdin); print(d.get("tool_input",{}).get("command",""))' 2>/dev/null || echo "")

# Only fire on git commit (not status, diff, log, etc.).
case "$command" in
  *"git commit"*)
    # Resolve project root so we can check TIME-LOG regardless of cwd.
    project_dir="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
    cd "$project_dir" 2>/dev/null || exit 0

    # Find the most recent commit's changeset. If TIME-LOG.md is in it, all good.
    if git diff-tree --no-commit-id --name-only -r HEAD 2>/dev/null | grep -qx 'TIME-LOG.md'; then
      exit 0
    fi

    # Check if the commit message contains "no-log-needed" or "[skip log]" — escape hatch.
    last_msg=$(git log -1 --pretty=%B 2>/dev/null || echo "")
    case "$last_msg" in
      *"[skip log]"*|*"no-log-needed"*) exit 0 ;;
    esac

    cat >&2 <<'EOF'
⚠ WARNING: this commit did not modify TIME-LOG.md.

If the commit reflects substantive work (writing docs, building features,
fixing bugs, decomposing tasks, etc.), invoke /log-time before your next
commit so the dashboard reflects the hours.

If the commit is genuinely log-free (typo fix, comment update, formatting),
add "[skip log]" to the commit message to silence this warning.

See docs/methodology/02-time-tracking-and-estimates.md for the discipline.
EOF
    ;;
esac

exit 0
