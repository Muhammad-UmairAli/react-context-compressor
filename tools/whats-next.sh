#!/usr/bin/env bash
# whats-next.sh — print a quick status dashboard for the project.
#
# Shows: git state, quality-config presence, pre-commit activation,
# branch-protection ruleset state, Git Flow / CCPM / VoltAgent /
# GetDesign integration presence, the most recent
# SPLIT-PLAN §5 (progress log) row, SPLIT-PLAN §6 (backlog) count,
# TODO.md open items, and the latest phase's render-check result.
# Ends with a heuristic "next action" suggestion.
#
# Designed to be called by the /whats-next slash command but also
# runnable standalone:
#
#   bash tools/whats-next.sh
#
# See docs/methodology/01-orchestration-spine.md.

set -euo pipefail

# Force UTF-8 stdout from any python3 we invoke. Without this, Windows
# Git Bash with a CP1252 locale corrupts § and — to �.
export PYTHONIOENCODING=utf-8
export PYTHONUTF8=1

if [[ -t 1 ]]; then
  C_BOLD=$'\033[1m'; C_DIM=$'\033[2m'
  C_GREEN=$'\033[32m'; C_RED=$'\033[31m'; C_YELLOW=$'\033[33m'; C_CYAN=$'\033[36m'
  C_RESET=$'\033[0m'
else
  C_BOLD=""; C_DIM=""
  C_GREEN=""; C_RED=""; C_YELLOW=""; C_CYAN=""
  C_RESET=""
fi

OK="${C_GREEN}✓${C_RESET}"
NO="${C_RED}✗${C_RESET}"
SKIP="${C_DIM}○${C_RESET}"
WARN="${C_YELLOW}!${C_RESET}"

have_cmd() { command -v "$1" >/dev/null 2>&1; }
exists()   { [[ -e "$1" ]]; }

# Resolve a working Python interpreter (skip Windows App-Execution-Alias stubs
# that are on PATH but fail when given arguments).
PYTHON=""
for _py in python3 python py; do
  if command -v "$_py" >/dev/null 2>&1 && "$_py" -c "" 2>/dev/null; then
    PYTHON="$_py"; break
  fi
done
unset _py

# ─── header ──────────────────────────────────────────────────────────────
printf '\n%sclaude-orchestration-kit — project status%s\n' "$C_BOLD" "$C_RESET"
printf '%s─────────────────────────────────────────────────────%s\n' "$C_DIM" "$C_RESET"

# ─── setup status ────────────────────────────────────────────────────────
printf '\n%sSETUP%s\n' "$C_BOLD" "$C_RESET"

if [[ ! -d .git ]]; then
  printf '  %s no git repository (run: git init)\n' "$NO"
  printf '\n%s no further checks possible.%s\n\n' "$C_DIM" "$C_RESET"
  exit 0
fi
printf '  %s git repository\n' "$OK"

OWNER_REPO=""
if REMOTE=$(git remote get-url origin 2>/dev/null); then
  OWNER_REPO=$(printf '%s' "$REMOTE" | sed -E 's#.*github\.com[:/]##' | sed -E 's#\.git$##')
  printf '  %s remote: %s\n' "$OK" "$OWNER_REPO"
else
  printf '  %s no git remote (add one to enable branch protection + CI)\n' "$WARN"
fi

# Quality configs
[[ -f .gitattributes          ]] && printf '  %s .gitattributes\n'          "$OK" || printf '  %s .gitattributes missing\n'          "$NO"
[[ -f .editorconfig           ]] && printf '  %s .editorconfig\n'           "$OK" || printf '  %s .editorconfig missing\n'           "$NO"
[[ -f .pre-commit-config.yaml ]] && printf '  %s .pre-commit-config.yaml\n' "$OK" || printf '  %s .pre-commit-config.yaml missing\n' "$NO"

# Integration wizard
WIZARD_RAN=false
if [[ -f .claude/.integrations-wizard-run ]]; then
  WIZARD_RUN_DATE=$(cat .claude/.integrations-wizard-run 2>/dev/null | head -1)
  printf '  %s integration wizard run (%s)\n' "$OK" "${WIZARD_RUN_DATE:-unknown}"
  WIZARD_RAN=true
else
  printf '  %s integration wizard NOT run yet (run: tools/setup-integrations.sh)\n' "$NO"
fi

# pre-commit hook activation
if [[ -f .git/hooks/pre-commit ]] && grep -q 'pre-commit' .git/hooks/pre-commit 2>/dev/null; then
  printf '  %s pre-commit hooks activated locally\n' "$OK"
else
  printf '  %s pre-commit not activated (run: uv tool install pre-commit && pre-commit install)\n' "$NO"
fi

# Branch protection
if [[ -n "$OWNER_REPO" ]] && have_cmd gh && gh auth status >/dev/null 2>&1; then
  RULESETS=$(gh api "repos/$OWNER_REPO/rulesets" --jq '.[].name' 2>/dev/null || echo "")
  if printf '%s\n' "$RULESETS" | grep -q '^main'; then
    printf '  %s branch protection on main\n' "$OK"
  else
    printf '  %s branch protection on main not applied\n' "$NO"
  fi
  if printf '%s\n' "$RULESETS" | grep -q '^develop'; then
    printf '  %s branch protection on develop\n' "$OK"
  fi
fi

# Git Flow
if git show-ref --verify --quiet refs/heads/develop \
  || git show-ref --verify --quiet refs/remotes/origin/develop; then
  printf '  %s Git Flow (develop branch present)\n' "$OK"
else
  printf '  %s base flow only (no develop branch)\n' "$SKIP"
fi

# CCPM
[[ -d .claude/ccpm ]] && printf '  %s CCPM installed\n' "$OK" || printf '  %s CCPM not installed\n' "$SKIP"

# VoltAgent — best-effort detection (project-local or global)
if [[ -d .claude/agents ]] || [[ -d "$HOME/.claude/agents" ]]; then
  printf '  %s VoltAgent agents directory present\n' "$OK"
else
  printf '  %s VoltAgent agents not detected\n' "$SKIP"
fi

# DESIGN.md
[[ -f docs/DESIGN.md ]] && printf '  %s docs/DESIGN.md present\n' "$OK" || printf '  %s docs/DESIGN.md not present\n' "$SKIP"

# ─── phase status ────────────────────────────────────────────────────────
printf '\n%sPHASE STATE%s\n' "$C_BOLD" "$C_RESET"

LAST_PHASE_LABEL=""
LAST_WHAT_NEXT=""
BACKLOG_COUNT=0
TODO_OPEN=0

if [[ -f SPLIT-PLAN.md ]] && [[ -n "$PYTHON" ]]; then
  read -r LAST_PHASE_LABEL LAST_WHAT_NEXT < <($PYTHON - <<'PYEOF'
import re
try:
    with open("SPLIT-PLAN.md", encoding="utf-8") as f:
        text = f.read()
except Exception:
    print("- -")
    raise SystemExit
m = re.search(r"##\s*§5.*?\n(.*?)(?=\n##\s*§|\Z)", text, re.DOTALL)
if not m:
    print("- -")
    raise SystemExit
section = m.group(1)
data_rows = []
for line in section.splitlines():
    s = line.strip()
    if not s.startswith("|"):
        continue
    if s.lower().startswith("| date") or set(s) <= set("|-: "):
        continue
    data_rows.append(s)
if not data_rows:
    print("none none")
    raise SystemExit
last = data_rows[-1].strip("|")
cells = [c.strip() for c in last.split("|")]
phase = cells[1] if len(cells) >= 2 else "-"
nxt   = cells[3] if len(cells) >= 4 else "-"
# Encode spaces with __ so the bash read picks up two tokens.
print(f"{phase.replace(' ', '_')} {nxt.replace(' ', '_')}")
PYEOF
)
  LAST_PHASE_LABEL=$(printf '%s' "$LAST_PHASE_LABEL" | tr '_' ' ')
  LAST_WHAT_NEXT=$(printf '%s' "$LAST_WHAT_NEXT" | tr '_' ' ')

  if [[ -n "$LAST_PHASE_LABEL" && "$LAST_PHASE_LABEL" != "none" ]]; then
    printf '  Last SPLIT-PLAN §5 (progress log) row: %s\n' "$LAST_PHASE_LABEL"
    printf '  Suggested next:                         %s\n' "$LAST_WHAT_NEXT"
  else
    printf '  %s no SPLIT-PLAN §5 (progress log) rows yet — Phase 1 not opened\n' "$WARN"
  fi

  BACKLOG_COUNT=$($PYTHON - <<'PYEOF'
import re
with open("SPLIT-PLAN.md", encoding="utf-8") as f:
    t = f.read()
m = re.search(r"##\s*§6.*?\n(.*?)(?=\n##\s*§|\Z)", t, re.DOTALL)
if not m:
    print(0); raise SystemExit
section = m.group(1)
bullets = [l for l in section.splitlines() if l.strip().startswith("- ") and "_(empty)_" not in l]
print(len(bullets))
PYEOF
)
  printf '  SPLIT-PLAN §6 (backlog):               %s item(s)\n' "$BACKLOG_COUNT"
else
  [[ -f SPLIT-PLAN.md ]] || printf '  %s SPLIT-PLAN.md missing\n' "$NO"
fi

if [[ -f TODO.md ]]; then
  TODO_OPEN=$(grep -c '^- \[ \]' TODO.md 2>/dev/null || echo 0)
  TODO_OPEN=${TODO_OPEN//[^0-9]/}
  # Subtract the kit's placeholder item ("_Item — owner — context_") if present.
  TODO_PLACEHOLDER=0
  if grep -qE '^- \[ \] _Item.*owner.*context' TODO.md 2>/dev/null; then
    TODO_PLACEHOLDER=1
  fi
  TODO_REAL=$(( TODO_OPEN - TODO_PLACEHOLDER ))
  if (( TODO_PLACEHOLDER > 0 )); then
    printf '  TODO.md open:                           %s (1 placeholder, %s real)\n' "$TODO_OPEN" "$TODO_REAL"
  else
    printf '  TODO.md open:                           %s\n' "$TODO_OPEN"
  fi
fi

# Detect whether SPLIT-PLAN §1 (goals) and §2 (out of scope) are still
# the kit's template placeholders. Used by the NEXT ACTION heuristic to
# surface goal-definition as the gating step before any phase work.
GOALS_PLACEHOLDER=false
if [[ -f SPLIT-PLAN.md ]] && grep -qE '_Goal 1_|_Goal 2_|_Out-of-scope 1_' SPLIT-PLAN.md 2>/dev/null; then
  GOALS_PLACEHOLDER=true
fi

# Latest phase render-check
if [[ -f DASHBOARD.html && -x tools/render-check.sh ]] && [[ -n "$PYTHON" ]]; then
  LAST_PHASE_ID=$($PYTHON - <<'PYEOF' 2>/dev/null || echo ""
import json, re, sys
try:
    with open("DASHBOARD.html", encoding="utf-8") as f:
        text = f.read()
    m = re.search(r'<script id="estimate-data"[^>]*>(.*?)</script>', text, re.DOTALL)
    if m:
        data = json.loads(m.group(1))
        ids = [p["id"] for p in data.get("phases", [])]
        if ids:
            print(ids[-1])
except Exception:
    pass
PYEOF
)
  if [[ -n "$LAST_PHASE_ID" ]]; then
    if ./tools/render-check.sh "$LAST_PHASE_ID" >/dev/null 2>&1; then
      printf '  %s DASHBOARD.html: phase %s renders cleanly\n' "$OK" "$LAST_PHASE_ID"
    else
      printf '  %s data files: phase %s has steps with no logged actual (run /log-time)\n' "$NO" "$LAST_PHASE_ID"
    fi
  fi
fi

# ─── next action heuristic ───────────────────────────────────────────────
printf '\n%sNEXT ACTION%s\n' "$C_BOLD" "$C_RESET"

next_action_msg() {
  if [[ ! -f SPLIT-PLAN.md ]]; then
    printf '  Run the kit init: /path/to/claude-orchestration-kit/tools/init-project.sh\n'
    return
  fi
  if [[ "$WIZARD_RAN" != "true" ]]; then
    printf '  Run the integration wizard to choose Git Flow, CCPM, VoltAgent,\n'
    printf '  GetDesign, branch protection, and pre-commit activation:\n'
    printf '      tools/setup-integrations.sh\n'
    printf '  Skipping individual questions is fine — the wizard records that\n'
    printf '  you made the choice consciously, so this prompt stops nagging.\n'
    return
  fi
  if [[ ! -f .git/hooks/pre-commit ]] || ! grep -q 'pre-commit' .git/hooks/pre-commit 2>/dev/null; then
    printf '  Activate pre-commit locally:\n'
    printf '      uv tool install pre-commit && pre-commit install\n'
    printf '  Or run tools/setup-integrations.sh and accept Q7.\n'
    return
  fi
  if [[ -n "$OWNER_REPO" ]] && have_cmd gh && gh auth status >/dev/null 2>&1; then
    if ! printf '%s\n' "${RULESETS:-}" | grep -q '^main'; then
      printf '  Apply branch protection:\n'
      printf '      tools/setup-integrations.sh   (Q6)\n'
      return
    fi
  fi
  if [[ "$GOALS_PLACEHOLDER" == "true" ]]; then
    printf '  Define your project: fill in SPLIT-PLAN §1 (goals) and SPLIT-PLAN §2 (out of scope).\n'
    printf '  Phase 1 opens once you have stated what you are building and what you are not.\n'
    return
  fi
  if (( BACKLOG_COUNT > 0 )); then
    printf '  Pick from SPLIT-PLAN §6 (backlog) — %s item(s) waiting.\n' "$BACKLOG_COUNT"
    return
  fi
  if (( ${TODO_REAL:-0} > 0 )); then
    printf '  TODO.md has %s real open item(s). Address one.\n' "${TODO_REAL:-0}"
    return
  fi
  if [[ -n "$LAST_WHAT_NEXT" && "$LAST_WHAT_NEXT" != "-" && "$LAST_WHAT_NEXT" != "none" ]]; then
    printf '  Per the most recent SPLIT-PLAN §5 (progress log) row:\n'
    printf '      %s%s%s\n' "$C_CYAN" "$LAST_WHAT_NEXT" "$C_RESET"
    return
  fi
  printf '  Define SPLIT-PLAN §1 (goals) and SPLIT-PLAN §2 (out of scope),\n'
  printf '  then open Phase 1 by adding a row to SPLIT-PLAN §5 (progress log).\n'
}

next_action_msg

printf '\n%s─────────────────────────────────────────────────────%s\n\n' "$C_DIM" "$C_RESET"
