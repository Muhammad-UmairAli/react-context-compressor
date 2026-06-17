#!/usr/bin/env bash
# Block direct commits to protected branches (main / master / develop).
# Defense-in-depth on top of the platform-level branch-protection rulesets.
# Reads PreToolUse JSON payload from stdin; exits 2 to block.
#
# See docs/methodology/03-github-workflow.md and 06-git-flow-and-environments.md.

set -euo pipefail

input=$(cat)

# Extract the Bash command, if any.
command=$(printf '%s' "$input" | python -c 'import json,sys; d=json.load(sys.stdin); print(d.get("tool_input",{}).get("command",""))' 2>/dev/null || echo "")

case "$command" in
  *"git commit"*)
    branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")
    case "$branch" in
      main|master|develop)
        echo "BLOCKED: direct commits to '$branch' are forbidden by claude-orchestration-kit." >&2
        echo "         Branch off and open a PR. Naming under Git Flow:" >&2
        echo "           - feature/<short>     (off develop, merges to develop)" >&2
        echo "           - release/<X.Y.Z>     (off develop, merges to main + back to develop)" >&2
        echo "           - hotfix/<X.Y.Z>      (off main,    merges to main + back to develop)" >&2
        echo "         Or under the base flow: phase-Nx-<short> / chore-<short> off main." >&2
        echo "         See docs/methodology/03-github-workflow.md and 06-git-flow-and-environments.md." >&2
        exit 2
        ;;
    esac
    ;;
esac

exit 0
