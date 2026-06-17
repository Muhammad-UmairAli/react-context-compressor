#!/usr/bin/env bash
# setup-integrations.sh — interactive wizard to wire up the kit's optional
# integrations: Git Flow, CCPM, VoltAgent, GetDesign.md, branch-protection
# rulesets, and a CI workflow placeholder for the chosen cloud.
#
# Run from the project root. Idempotent — rerun anytime to add integrations
# you skipped earlier.
#
# Flags:
#   --non-interactive    use defaults for every question (yes by default)
#   --defaults all       yes to everything that's automatable
#   --defaults minimal   no to everything (kit shipped, nothing else)
#
# See docs/methodology/06-git-flow-and-environments.md for branching and
# docs/methodology/12-autonomy-and-approvals.md for the autonomy modes.

set -euo pipefail

NON_INTERACTIVE=false
DEFAULTS_SET=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --non-interactive) NON_INTERACTIVE=true; shift ;;
    --defaults)        NON_INTERACTIVE=true; DEFAULTS_SET="${2:-}"; shift 2 ;;
    -h|--help)
      sed -n '1,18p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *) echo "unknown flag: $1" >&2; exit 1 ;;
  esac
done

# Refuse interactive mode without a real TTY on stdin. Without this,
# `read -rp` returns empty immediately and every question silently
# defaults — confusing because the wizard appears to run but never asks.
if ! $NON_INTERACTIVE && [[ ! -t 0 ]]; then
  cat >&2 <<'EOFTTY'
ERROR: stdin is not a terminal. The wizard needs an interactive shell.

This usually means you ran the wizard via Claude Code's Bash tool, which
cannot pass keystrokes through. Two ways forward:

  1. Run the wizard in your own terminal (Git Bash, PowerShell with
     "& 'C:/Program Files/Git/bin/bash.exe' tools/setup-integrations.sh",
     or any shell with an interactive stdin):

         tools/setup-integrations.sh

  2. Run non-interactively with --defaults:

         tools/setup-integrations.sh --defaults all      # yes to everything
         tools/setup-integrations.sh --defaults minimal  # no to everything

  3. From inside a Claude Code session, ask the AI to run the wizard
     interactively via the /setup-integrations slash command — Claude
     asks each question in chat, then executes the action you choose.
EOFTTY
  exit 1
fi

# Color helpers (skip if not a terminal)
if [[ -t 1 ]]; then
  C_RESET=$'\033[0m'; C_BOLD=$'\033[1m'; C_DIM=$'\033[2m'
  C_GREEN=$'\033[32m'; C_YELLOW=$'\033[33m'
else
  C_RESET=""; C_BOLD=""; C_DIM=""; C_GREEN=""; C_YELLOW=""
fi

say()      { printf '%s\n' "$*"; }
hdr()      { printf '\n%s── %s ──%s\n' "$C_BOLD" "$*" "$C_RESET"; }
done_msg() { printf '  %s✓%s %s\n'    "$C_GREEN"  "$C_RESET" "$*"; }
skip_msg() { printf '  %s- skipped:%s %s\n' "$C_DIM" "$C_RESET" "$*"; }
warn()     { printf '  %s!%s %s\n'    "$C_YELLOW" "$C_RESET" "$*" >&2; }

# Resolve a working Python interpreter (skip Windows App-Execution-Alias stubs).
PYTHON=""
for _py in python3 python py; do
  if command -v "$_py" >/dev/null 2>&1 && "$_py" -c "" 2>/dev/null; then
    PYTHON="$_py"; break
  fi
done
unset _py

prompt_yn() {
  local q="$1" default="$2" reply
  if $NON_INTERACTIVE; then
    case "$DEFAULTS_SET" in
      all)     return 0 ;;
      minimal) return 1 ;;
      *)       [[ "$default" == "y" ]] && return 0 || return 1 ;;
    esac
  fi
  while true; do
    if [[ "$default" == "y" ]]; then read -rp "$q [Y/n]: " reply
    else                              read -rp "$q [y/N]: " reply
    fi
    reply=${reply:-$default}
    case "$reply" in
      [yY]|[yY]es) return 0 ;;
      [nN]|[nN]o)  return 1 ;;
      [qQ]|[qQ]uit) say "Aborted."; exit 0 ;;
      *) say "  Please answer y or n (or q to quit)." ;;
    esac
  done
}

prompt_choice() {
  # prompt_choice "question" default <option-1> <option-2> ...
  # Writes UI to stderr so the chosen option (echoed to stdout) is the
  # only thing captured by `var=$(prompt_choice ...)` callers.
  local q="$1" default="$2"; shift 2
  local options=("$@")
  if $NON_INTERACTIVE; then echo "$default"; return; fi
  say "$q" >&2
  local i=1
  for opt in "${options[@]}"; do
    if [[ "$opt" == "$default" ]]; then
      say "  $i) $opt (default)" >&2
    else
      say "  $i) $opt" >&2
    fi
    i=$((i+1))
  done
  while true; do
    read -rp "Choice [1-${#options[@]}]: " choice
    if [[ -z "$choice" ]]; then echo "$default"; return; fi
    if [[ "$choice" =~ ^[0-9]+$ ]] && (( choice >= 1 && choice <= ${#options[@]} )); then
      echo "${options[$((choice-1))]}"
      return
    fi
    say "  Please enter a number between 1 and ${#options[@]}." >&2
  done
}

prompt_text() {
  local q="$1" default="${2:-}" reply
  if $NON_INTERACTIVE; then echo "$default"; return; fi
  if [[ -n "$default" ]]; then read -rp "$q [$default]: " reply
  else                          read -rp "$q: " reply
  fi
  echo "${reply:-$default}"
}

prompt_text_required() {
  # Like prompt_text but loops until a non-empty value is given.
  local q="$1" reply
  if $NON_INTERACTIVE; then echo "${2:-}"; return; fi
  while true; do
    read -rp "$q: " reply
    reply="${reply#"${reply%%[![:space:]]*}"}"   # ltrim
    reply="${reply%"${reply##*[![:space:]]}"}"   # rtrim
    if [[ -n "$reply" ]]; then echo "$reply"; return; fi
    say "  This field is required — please enter a value." >&2
  done
}

# ---------- Welcome ----------

cat <<EOF

${C_BOLD}claude-orchestration-kit — integration wizard${C_RESET}

This wizard configures your project in 8 steps. It only needs to run
once, but you can re-run it anytime to change your answers.

  1/8  Project name       — names your dashboard header
  2/8  Branching model    — base flow (main only) or Git Flow
                            (develop + release/* + hotfix/*)
  3/8  Cloud provider     — UAT/PROD deployment target (Git Flow only)
  4/8  CCPM               — parallel task decomposition with Git worktrees
  5/8  AI plugins         — VoltAgent specialists or Claude Superpowers
  6/8  Design identity    — pick a brand-inspired theme for your dashboard
  7/8  Branch protection  — apply GitHub rulesets to main (and develop)
  8/8  Pre-commit hooks   — activate local commit-time quality checks

Press Enter to accept the default for each step. Type 'q' anytime to quit.
EOF

# ---------- 1/8  Project name (mandatory) ----------

${PYTHON:-python3} tools/estimate.py 0 17 0.014 0.014 "Integration Wizard - Project name" 2>/dev/null || true
${PYTHON:-python3} tools/start-task.py 0 17 "Integration Wizard - Project name" 2>/dev/null || true
hdr "1/8  Project name"
say "  The name you enter will appear in the Project Dashboard header"
say "  in DASHBOARD.html — open it anytime to see it."
say ""

PROJECT_NAME=$(prompt_text_required "Project name (e.g. Acme Billing Rewrite)")
mkdir -p .claude
echo "$PROJECT_NAME" > .claude/project-name
# Write project name into DASHBOARD.html's project-config JSON block.
${PYTHON:-python3} - "$PROJECT_NAME" <<'PYEOF' 2>/dev/null || true
import sys, json, re
name = sys.argv[1]
try:
    with open('DASHBOARD.html', encoding='utf-8') as f:
        html = f.read()
    m = re.search(r'(<script[^>]*id="project-config"[^>]*>)(.*?)(</script>)', html, re.DOTALL)
    if m:
        cfg = json.loads(m.group(2))
        cfg['project_name'] = name
        replacement = m.group(1) + '\n' + json.dumps(cfg, indent=2) + '\n' + m.group(3)
        html = html[:m.start()] + replacement + html[m.end():]
        with open('DASHBOARD.html', 'w', encoding='utf-8') as f:
            f.write(html)
except Exception as e:
    print(f"Warning: could not update DASHBOARD.html: {e}", file=__import__('sys').stderr)
PYEOF
done_msg "Project name set to '$PROJECT_NAME' (DASHBOARD.html updated)."
${PYTHON:-python3} tools/log-time.py 0 17 0 "Integration Wizard - Project name" 2>/dev/null || true

# ---------- 2/8  Branching model ----------

${PYTHON:-python3} tools/estimate.py 0 18 0.008 0.008 "Integration Wizard - Branching model" 2>/dev/null || true
${PYTHON:-python3} tools/start-task.py 0 18 "Integration Wizard - Branching model" 2>/dev/null || true
hdr "2/8  Branching model"
say "  base flow — single 'main' branch, every change via PR"
say "  Git Flow — develop, release/*, hotfix/* — needed for projects with"
say "             deployable UAT/PROD environments"

if prompt_yn "Use Git Flow?" "n"; then
  USE_GIT_FLOW=true
  if [[ -d .git ]] && ! git show-ref --verify --quiet refs/heads/develop; then
    git checkout -b develop >/dev/null 2>&1 || git checkout develop >/dev/null 2>&1
    done_msg "Created local 'develop' branch."
    if git remote get-url origin >/dev/null 2>&1; then
      if git push -u origin develop >/dev/null 2>&1; then
        done_msg "Pushed develop to origin."
      else
        warn "Could not push develop to origin (push manually later)."
      fi
    fi
  else
    done_msg "Git Flow selected (develop branch already exists or no .git yet)."
  fi
else
  USE_GIT_FLOW=false
  skip_msg "Base flow only — single main branch."
fi
${PYTHON:-python3} tools/log-time.py 0 18 0 "Integration Wizard - Branching model" 2>/dev/null || true

# ---------- 3/8  Cloud provider ----------

${PYTHON:-python3} tools/estimate.py 0 19 0.006 0.006 "Integration Wizard - Cloud provider" 2>/dev/null || true
${PYTHON:-python3} tools/start-task.py 0 19 "Integration Wizard - Cloud provider" 2>/dev/null || true
if $USE_GIT_FLOW; then
  hdr "3/8  Cloud provider for UAT and PROD"
  CLOUD=$(prompt_choice "Which cloud will host UAT and PROD?" "azure" \
    azure aws gcp other none)

  case "$CLOUD" in
    none)
      skip_msg "No cloud — env promotion will be manual."
      ;;
    *)
      mkdir -p .github/workflows
      cat > .github/workflows/README.md <<WFEOF
# CI/CD workflows for $CLOUD

This project uses Git Flow with environment promotion (see
\`docs/methodology/06-git-flow-and-environments.md\`). Wire up:

| Workflow file       | Trigger                                | Action                |
|---------------------|----------------------------------------|-----------------------|
| \`ci.yml\`            | every PR                                | tests + lint          |
| \`deploy-uat.yml\`    | push or merge to \`release/*\` / \`hotfix/*\` | build + deploy to UAT |
| \`deploy-prod.yml\`   | push to \`main\`                          | build + deploy to PROD + tag |

The kit doesn't ship full YAML for $CLOUD — adapt your existing $CLOUD
samples or use the official $CLOUD GitHub Actions starters.
WFEOF
      done_msg "Wrote .github/workflows/README.md as a TODO placeholder for $CLOUD."
      ;;
  esac
else
  skip_msg "3/8  Cloud question — skipped (Git Flow not selected)."
fi
${PYTHON:-python3} tools/log-time.py 0 19 0 "Integration Wizard - Cloud provider" 2>/dev/null || true

# ---------- 4/8  CCPM ----------

${PYTHON:-python3} tools/estimate.py 0 20 0.011 0.011 "Integration Wizard - CCPM" 2>/dev/null || true
${PYTHON:-python3} tools/start-task.py 0 20 "Integration Wizard - CCPM" 2>/dev/null || true
hdr "4/8  CCPM (decomposition + parallel execution)"
say "  PRD → Epic → Task with parallel/depends_on metadata + Git worktrees"
say "  for concurrent agent execution. See"
say "  docs/methodology/integrations/ccpm.md."

if [[ -d .claude/ccpm ]]; then
  skip_msg "CCPM already installed at .claude/ccpm."
elif prompt_yn "Install CCPM?" "y"; then
  if command -v git >/dev/null 2>&1; then
    mkdir -p .claude
    if git clone --quiet https://github.com/automazeio/ccpm .claude/ccpm 2>/dev/null; then
      rm -rf .claude/ccpm/.git
      done_msg "Cloned CCPM into .claude/ccpm (nested .git removed — prevents gitlink in outer repo)."
      say "  Follow CCPM's own README for slash-command registration."
    else
      warn "git clone failed. Retry: git clone https://github.com/automazeio/ccpm .claude/ccpm && rm -rf .claude/ccpm/.git"
    fi
  else
    warn "git not on PATH; cannot clone CCPM."
  fi
else
  skip_msg "CCPM — skipped."
fi
${PYTHON:-python3} tools/log-time.py 0 20 0 "Integration Wizard - CCPM" 2>/dev/null || true

# ---------- 5/8  AI plugins ----------

${PYTHON:-python3} tools/estimate.py 0 21 0.020 0.020 "Integration Wizard - AI plugins" 2>/dev/null || true
${PYTHON:-python3} tools/start-task.py 0 21 "Integration Wizard - AI plugins" 2>/dev/null || true
hdr "5/8  AI plugins (specialist personas & skills)"
say "  voltagent   — 130+ specialists: code-reviewer, security-auditor, debugger,"
say "                language-pros, etc. (VoltAgent/awesome-claude-code-subagents)"
say "  superpowers — skills framework: TDD, debugging, brainstorming, code-review"
say "                agent. (obra/superpowers)"

AI_PLUGIN=$(prompt_choice "Which AI plugins to install?" "voltagent" \
  voltagent superpowers skip)

if [[ "$AI_PLUGIN" != "skip" ]]; then
  if ! command -v claude >/dev/null 2>&1; then
    warn "Claude Code CLI ('claude') not on PATH. After installing it, run the relevant commands manually."
    warn "  VoltAgent:   claude plugin marketplace add VoltAgent/awesome-claude-code-subagents"
    warn "               claude plugin install voltagent-core-dev  (and voltagent-lang, voltagent-qa-sec, voltagent-meta)"
    warn "  Superpowers: claude plugin install superpowers@claude-plugins-official"
  elif [[ "$AI_PLUGIN" == "voltagent" ]]; then
    if claude plugin marketplace add VoltAgent/awesome-claude-code-subagents >/dev/null 2>&1; then
      done_msg "VoltAgent marketplace added."
    else
      warn "VoltAgent marketplace add failed (already added?)"
    fi
    for _va_plugin in voltagent-core-dev voltagent-lang voltagent-qa-sec voltagent-meta; do
      if claude plugin install "$_va_plugin" >/dev/null 2>&1; then
        done_msg "Installed $_va_plugin."
      else
        warn "Install of $_va_plugin failed; run 'claude plugin install $_va_plugin' manually."
      fi
    done
  elif [[ "$AI_PLUGIN" == "superpowers" ]]; then
    if claude plugin install "superpowers@claude-plugins-official" >/dev/null 2>&1; then
      done_msg "Installed Superpowers."
    else
      warn "Install failed; run 'claude plugin install superpowers@claude-plugins-official' manually."
    fi
  fi

  if [[ "$AI_PLUGIN" == "voltagent" ]]; then
    ${PYTHON:-python3} - <<'PYEOF' 2>/dev/null || true
import json, re
with open('DASHBOARD.html', encoding='utf-8') as f: html = f.read()
m = re.search(r'(<script[^>]*id="integrations-data"[^>]*>)(.*?)(</script>)', html, re.DOTALL)
if m:
    d = json.loads(m.group(2)); d['voltagent'] = True
    html = html[:m.start()] + m.group(1) + '\n' + json.dumps(d, indent=2) + '\n' + m.group(3) + html[m.end():]
    with open('DASHBOARD.html', 'w', encoding='utf-8') as f: f.write(html)
PYEOF
  elif [[ "$AI_PLUGIN" == "superpowers" ]]; then
    ${PYTHON:-python3} - <<'PYEOF' 2>/dev/null || true
import json, re
with open('DASHBOARD.html', encoding='utf-8') as f: html = f.read()
m = re.search(r'(<script[^>]*id="integrations-data"[^>]*>)(.*?)(</script>)', html, re.DOTALL)
if m:
    d = json.loads(m.group(2)); d['superpowers'] = True
    html = html[:m.start()] + m.group(1) + '\n' + json.dumps(d, indent=2) + '\n' + m.group(3) + html[m.end():]
    with open('DASHBOARD.html', 'w', encoding='utf-8') as f: f.write(html)
PYEOF
  fi
else
  skip_msg "AI plugins — skipped."
fi
${PYTHON:-python3} tools/log-time.py 0 21 0 "Integration Wizard - AI plugins" 2>/dev/null || true

# ---------- 6/8  GetDesign.md ----------

${PYTHON:-python3} tools/estimate.py 0 22 0.004 0.004 "Integration Wizard - Design identity" 2>/dev/null || true
${PYTHON:-python3} tools/start-task.py 0 22 "Integration Wizard - Design identity" 2>/dev/null || true
hdr "6/8  GetDesign.md (design-system context)"
say "  Production-grade DESIGN.md specs you drop in for AI agents doing UI"
say "  work. See docs/methodology/integrations/getdesign.md."

if prompt_yn "Drop in a DESIGN.md from getdesign.md?" "n"; then
  say "  Browse https://www.getdesign.md/ and copy the URL of the DESIGN.md"
  say "  you want. Common picks: stripe, notion, github, apple, linear."
  URL=$(prompt_text "Paste the DESIGN.md URL (empty to skip)" "")
  if [[ -n "$URL" ]]; then
    mkdir -p docs
    if command -v curl >/dev/null 2>&1; then
      if curl -fsSL "$URL" -o docs/DESIGN.md; then
        done_msg "Saved to docs/DESIGN.md."
        say "  Add a row to SPLIT-PLAN §4 (cross-cutting concepts) pointing at"
        say "  docs/DESIGN.md so future UI work follows the spec."
      else
        warn "Download failed. Save the file manually to docs/DESIGN.md."
      fi
    else
      warn "curl not on PATH. Save the file manually to docs/DESIGN.md."
    fi
  else
    skip_msg "GetDesign.md — no URL provided."
  fi
else
  skip_msg "GetDesign.md — skipped."
fi
${PYTHON:-python3} tools/log-time.py 0 22 0 "Integration Wizard - Design identity" 2>/dev/null || true

# ---------- 7/8  Branch protection ----------

${PYTHON:-python3} tools/estimate.py 0 23 0.050 0.050 "Integration Wizard - Branch protection" 2>/dev/null || true
${PYTHON:-python3} tools/start-task.py 0 23 "Integration Wizard - Branch protection" 2>/dev/null || true
hdr "7/8  Branch protection rulesets"
say "  Apply the kit's ruleset(s) to your GitHub repo. Requires gh CLI"
say "  authenticated and the repo to exist on GitHub."

if ! command -v gh >/dev/null 2>&1; then
  warn "gh CLI not on PATH. Install later, then run:"
  say "    gh api -X POST /repos/<owner>/<repo>/rulesets --input .github/rulesets/main.json"
elif ! gh auth status >/dev/null 2>&1; then
  warn "gh CLI is not authenticated. Run 'gh auth login' first."
else
  REMOTE=$(git remote get-url origin 2>/dev/null || echo "")
  if [[ -z "$REMOTE" ]]; then
    skip_msg "No GitHub remote on this repo. Add one and rerun this wizard."
  else
    OWNER_REPO=$(echo "$REMOTE" \
      | sed -E 's#.*github\.com[:/]##' \
      | sed -E 's#\.git$##')
    if prompt_yn "Apply main protection ruleset to $OWNER_REPO?" "y"; then
      if gh api -X POST "/repos/$OWNER_REPO/rulesets" \
           -H "Accept: application/vnd.github+json" \
           --input .github/rulesets/main.json >/dev/null 2>&1; then
        done_msg "Applied main ruleset."
      else
        warn "Failed to apply main ruleset (already exists, or insufficient perms)."
      fi
    fi
    if $USE_GIT_FLOW && [[ -f .github/rulesets/develop.json ]]; then
      if prompt_yn "Apply develop protection ruleset to $OWNER_REPO?" "y"; then
        if gh api -X POST "/repos/$OWNER_REPO/rulesets" \
             -H "Accept: application/vnd.github+json" \
             --input .github/rulesets/develop.json >/dev/null 2>&1; then
          done_msg "Applied develop ruleset."
        else
          warn "Failed to apply develop ruleset (already exists, or insufficient perms)."
        fi
      fi
    fi
  fi
fi
${PYTHON:-python3} tools/log-time.py 0 23 0 "Integration Wizard - Branch protection" 2>/dev/null || true

# ---------- 8/8  Pre-commit hooks ----------

${PYTHON:-python3} tools/estimate.py 0 24 0.017 0.017 "Integration Wizard - Pre-commit hooks" 2>/dev/null || true
${PYTHON:-python3} tools/start-task.py 0 24 "Integration Wizard - Pre-commit hooks" 2>/dev/null || true
hdr "8/8  Local commit-time hooks (pre-commit framework)"
say "  Activates .pre-commit-config.yaml: trailing-whitespace, end-of-file,"
say "  line-ending → LF, prettier, actionlint, large-file check, etc."
say "  Catches issues before commit; same hooks run in CI on every PR."

if prompt_yn "Install pre-commit and activate hooks now?" "y"; then
  if command -v uv >/dev/null 2>&1; then
    if uv tool install pre-commit --quiet 2>/dev/null; then
      done_msg "Installed pre-commit (via uv)."
    else
      warn "uv tool install pre-commit failed; install manually: uv tool install pre-commit"
    fi
  elif command -v pip3 >/dev/null 2>&1 || command -v pip >/dev/null 2>&1; then
    PIP=$(command -v pip3 2>/dev/null || command -v pip)
    if "$PIP" install --quiet --user pre-commit 2>/dev/null \
       || "$PIP" install --quiet pre-commit 2>/dev/null; then
      done_msg "Installed pre-commit (via pip)."
    else
      warn "pip install pre-commit failed; install manually."
    fi
  else
    warn "Neither uv nor pip found. Install pre-commit manually:"
    say "    uv tool install pre-commit  # recommended"
    say "    pip install pre-commit      # alternative"
  fi
  if command -v pre-commit >/dev/null 2>&1; then
    if pre-commit install >/dev/null 2>&1; then
      done_msg "pre-commit hooks activated. Every 'git commit' now runs them."
    else
      warn "pre-commit install failed (run manually after fixing)."
    fi
  else
    warn "'pre-commit' not on PATH after install. You may need to restart your shell, then run 'pre-commit install'."
  fi
else
  skip_msg "pre-commit — skipped. Run 'uv tool install pre-commit && pre-commit install' anytime."
fi
${PYTHON:-python3} tools/log-time.py 0 24 0 "Integration Wizard - Pre-commit hooks" 2>/dev/null || true

# ---------- Done ----------

# Write a marker file so tools/whats-next.sh can tell the wizard has been
# offered (regardless of which answers were chosen). The marker stops the
# dashboard from nagging adopters who deliberately declined integrations.
mkdir -p .claude
date -u +"%Y-%m-%dT%H:%M:%SZ" > .claude/.integrations-wizard-run

cat <<EOF

${C_GREEN}${C_BOLD}✓ Integration wizard complete.${C_RESET}

Re-run anytime: ${C_BOLD}tools/setup-integrations.sh${C_RESET}
Non-interactive: ${C_BOLD}tools/setup-integrations.sh --defaults all${C_RESET}

Next: edit SPLIT-PLAN §0 (header), SPLIT-PLAN §1 (goals), and
SPLIT-PLAN §2 (out of scope), then open Phase 1.
EOF
