#!/usr/bin/env python3
"""seed-test-data.py — populate .claude/*.json for dashboard testing.

Skips the full init-project / setup-wizard flow. Uses the same Python scripts
the kit normally uses (estimate.py, log-time.py, log-agent.py) so the data is
in the exact format DASHBOARD.html expects.

Usage (from project root):
  python tools/seed-test-data.py                       # append to existing data
  python tools/seed-test-data.py --reset               # wipe .claude/*.json and reseed
  python tools/seed-test-data.py --wizard-pending      # set wizard state → not complete
  python tools/seed-test-data.py --wizard-done         # set wizard state → complete
  python tools/seed-test-data.py --reset --wizard-done # full reset + wizard complete

Wizard flags update integrations-data + project-config in all DASHBOARD.html
files found, and create/remove .claude/.integrations-wizard-run accordingly.
Wizard flags can be combined with --reset or used standalone.

After running --reset, open DASHBOARD.html:
  - Phase 1 "Core feature build" — all 5 steps timed, phase closed/collapsed.
  - Phase 2 "Dashboard and reporting" — 2 of 3 steps timed, one shows '—'.
  - Agents tab — 11 spawns, 3 parallel groups, max 3 agents in parallel.
"""

import importlib.util
import json
import os
import re
import subprocess
import sys
from pathlib import Path

os.environ.setdefault("PYTHONIOENCODING", "utf-8")
try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except (AttributeError, ValueError):
    pass

TOOLS_DIR = Path(__file__).parent
CLAUDE_DIR = Path(".claude")

# ── stub templates for missing prerequisite files ──────────────────────────

TIME_LOG_STUB = """\
# TIME-LOG.md

Human-readable audit trail of actual hours per phase per step. Canonical data
is in .claude/time-log.json. This file is append-only, not parsed by any tool.

| Date | Phase | Step | Hours | Who | Notes |
|---|---|---|---|---|---|
"""

AGENT_LOG_STUB = """\
# AGENT-LOG.md — agent spawn audit log

Appended automatically by tools/log-agent.py.
**Do not edit manually.** Claude is the sole writer.

| Date | Phase | Step | Framework | AgentName | Parallel | Notes |
| ---- | ----- | ---- | --------- | --------- | -------- | ----- |
"""

# ── seed data ──────────────────────────────────────────────────────────────
# (phase, step, baseline_h, ai_h, description)
ESTIMATES = [
    ("1", "1", "0.50", "0.25", "Scaffold HTML shell + Tailwind CDN"),
    ("1", "2", "1.50", "0.75", "Implement data models and API endpoints"),
    ("1", "3", "2.00", "1.00", "Build UI components and wire to API"),
    ("1", "4", "1.00", "0.50", "Write unit tests (coverage > 80%)"),
    ("1", "5", "0.50", "0.25", "Code review, fix findings, merge PR"),
    ("2", "1", "0.75", "0.50", "Design dashboard wireframes"),
    ("2", "2", "2.00", "1.00", "Implement charts with Chart.js"),
    ("2", "3", "0.75", "0.50", "Add CSV export feature"),
]

# (phase, step, hours, notes) — Phase 2 step 3 omitted intentionally to show '—'
TIME_ENTRIES = [
    ("1", "1", "0.22", "Scaffolded HTML shell + Tailwind CDN (Closes #2)"),
    ("1", "2", "0.81", "Implemented REST endpoints + SQLite models (Closes #3)"),
    ("1", "3", "0.93", "Built component tree, wired API calls, added loading states (Closes #4)"),
    ("1", "4", "0.48", "Added pytest suite — 87% coverage (Closes #5)"),
    ("1", "5", "0.31", "Addressed 3 review comments, rebased, merged (Closes #6)"),
    ("2", "1", "0.45", "Produced wireframes for 4 dashboard views (Closes #7)"),
    ("2", "2", "1.21", "Implemented line + bar charts with drill-down (Closes #8)"),
]

# (phase, step, framework, agent_name, parallel, notes)
AGENT_ENTRIES = [
    ("1", "1", "Claude",    "general-purpose",    "n", "Scaffold project structure"),
    ("1", "2", "Claude",    "frontend-developer", "y", "Build API route handlers"),
    ("1", "2", "VoltAgent", "backend-developer",  "y", "Design SQLite schema"),
    ("1", "3", "Claude",    "react-specialist",   "y", "Build component tree"),
    ("1", "3", "VoltAgent", "ui-designer",        "y", "Review component hierarchy"),
    ("1", "3", "VoltAgent", "code-reviewer",      "y", "Catch prop-drilling issues"),
    ("1", "4", "Claude",    "qa-expert",          "n", "Write pytest fixtures"),
    ("1", "5", "VoltAgent", "code-reviewer",      "n", "Final PR review"),
    ("2", "1", "VoltAgent", "ui-designer",        "n", "Wireframe dashboard layout"),
    ("2", "2", "Claude",    "react-specialist",   "y", "Chart component scaffolding"),
    ("2", "2", "VoltAgent", "frontend-developer", "y", "Chart.js integration"),
]

# Phase labels (written directly to plan-data.json after estimate.py runs)
PHASE_LABELS = {
    "1": "Example: Core feature build",
    "2": "Example: Dashboard and reporting",
}

# Phase 1 is completed — tests the auto-collapse feature
COMPLETED_PHASES = {"1"}


def run(args: list[str], ok_exits: tuple[int, ...] = (0,)) -> None:
    cmd = [sys.executable] + [str(a) for a in args]
    result = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8")
    if result.returncode not in ok_exits:
        sys.stderr.write(f"ERROR running {' '.join(cmd)}:\n{result.stderr}\n")
        sys.exit(1)
    if result.stdout.strip():
        for line in result.stdout.strip().splitlines():
            print(f"  {line}")


def load_regen_js():
    spec = importlib.util.spec_from_file_location("_data_js", TOOLS_DIR / "_data_js.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod.regen_js


def reset_data_files() -> None:
    for name in ("time-log.json", "agents-log.json", "plan-data.json",
                 "time-log.js", "agents-log.js", "plan-data.js"):
        p = CLAUDE_DIR / name
        if p.exists():
            p.unlink()
            print(f"  deleted {p}")


def ensure_stubs() -> None:
    CLAUDE_DIR.mkdir(parents=True, exist_ok=True)
    for stub_path, stub_content in [
        (Path("TIME-LOG.md"), TIME_LOG_STUB),
        (Path("AGENT-LOG.md"), AGENT_LOG_STUB),
    ]:
        if not stub_path.exists():
            stub_path.write_text(stub_content, encoding="utf-8")
            print(f"  created stub {stub_path}")


def set_phase_labels_and_completion(regen_js) -> None:
    import datetime as _dt
    pj = CLAUDE_DIR / "plan-data.json"
    pjs = CLAUDE_DIR / "plan-data.js"
    plan: dict = {}
    if pj.exists():
        try:
            plan = json.loads(pj.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            plan = {}
    today = _dt.date.today().isoformat()
    for phase, label in PHASE_LABELS.items():
        if phase in plan:
            plan[phase]["label"] = label
        if phase in COMPLETED_PHASES:
            plan.setdefault(phase, {})["completed"] = today
    pj.write_text(json.dumps(plan, indent=2, ensure_ascii=True) + "\n", encoding="utf-8")
    regen_js(pj, pjs, "PLAN_DATA")
    print(f"  set phase labels + completed={today} for phase(s): {', '.join(sorted(COMPLETED_PHASES))}")


WIZARD_DONE_INTEGRATIONS = {
    "git_flow": True,
    "ccpm": True,
    "voltagent": True,
    "getdesign": True,
    "branch_protection": True,
    "pre_commit": True,
}
WIZARD_PENDING_INTEGRATIONS = {
    "git_flow": False,
    "ccpm": False,
    "voltagent": False,
    "getdesign": False,
    "branch_protection": False,
    "pre_commit": False,
}
WIZARD_DONE_PROJECT_NAME = "Example Project"
WIZARD_MARKER = CLAUDE_DIR / ".integrations-wizard-run"
WIZARD_PROJECT_NAME_FILE = CLAUDE_DIR / "project-name"


def _update_html_json_block(html: str, block_id: str, new_data: dict) -> str:
    pattern = r'(<script[^>]*id="{}"[^>]*>)(.*?)(</script>)'.format(re.escape(block_id))
    m = re.search(pattern, html, re.DOTALL)
    if not m:
        return html
    replacement = m.group(1) + "\n" + json.dumps(new_data, indent=2) + "\n" + m.group(3)
    return html[: m.start()] + replacement + html[m.end() :]


def seed_wizard_state(done: bool) -> None:
    import datetime as _dt

    label = "done" if done else "pending"
    integrations = WIZARD_DONE_INTEGRATIONS if done else WIZARD_PENDING_INTEGRATIONS
    project_name = WIZARD_DONE_PROJECT_NAME if done else ""

    # Find all DASHBOARD.html files (root and templates/).
    dash_paths = [p for p in [Path("DASHBOARD.html"), Path("templates/DASHBOARD.html")] if p.exists()]
    if not dash_paths:
        print(f"  [wizard-{label}] no DASHBOARD.html found — skipping HTML update")
    for dash in dash_paths:
        html = dash.read_text(encoding="utf-8")
        html = _update_html_json_block(html, "integrations-data", integrations)
        html = _update_html_json_block(html, "project-config", {"project_name": project_name})
        dash.write_text(html, encoding="utf-8")
        print(f"  [wizard-{label}] updated integrations-data + project-config in {dash}")

    CLAUDE_DIR.mkdir(parents=True, exist_ok=True)
    if done:
        ts = _dt.datetime.now(_dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        WIZARD_MARKER.write_text(ts + "\n", encoding="utf-8")
        WIZARD_PROJECT_NAME_FILE.write_text(project_name + "\n", encoding="utf-8")
        print(f"  [wizard-{label}] created .integrations-wizard-run ({ts})")
        print(f"  [wizard-{label}] wrote .claude/project-name = '{project_name}'")
    else:
        if WIZARD_MARKER.exists():
            WIZARD_MARKER.unlink()
            print(f"  [wizard-{label}] removed .integrations-wizard-run")
        if WIZARD_PROJECT_NAME_FILE.exists():
            WIZARD_PROJECT_NAME_FILE.unlink()
            print(f"  [wizard-{label}] removed .claude/project-name")


def main(argv: list[str]) -> int:
    do_reset = "--reset" in argv
    do_wizard_done = "--wizard-done" in argv
    do_wizard_pending = "--wizard-pending" in argv

    if do_wizard_done and do_wizard_pending:
        sys.stderr.write("ERROR: --wizard-done and --wizard-pending are mutually exclusive.\n")
        return 1

    if not (TOOLS_DIR / "estimate.py").exists():
        sys.stderr.write(
            "ERROR: run from the project root (tools/ must be a sibling directory).\n"
        )
        return 1

    print("seed-test-data: populating .claude/ data files for dashboard testing...")
    print()

    if do_reset:
        print("[reset] wiping existing data files...")
        reset_data_files()
        print()

    ensure_stubs()

    regen_js = load_regen_js()

    print(f"[estimates] writing {len(ESTIMATES)} step estimates via estimate.py...")
    for phase, step, baseline, ai, desc in ESTIMATES:
        run([TOOLS_DIR / "estimate.py", phase, step, baseline, ai, desc])
    print()

    print(f"[actuals] writing {len(TIME_ENTRIES)} time entries via log-time.py...")
    for phase, step, hours, notes in TIME_ENTRIES:
        run([TOOLS_DIR / "log-time.py", phase, step, hours, notes])
    print()

    print(f"[agents] writing {len(AGENT_ENTRIES)} agent spawns via log-agent.py...")
    for phase, step, fw, agent, parallel, notes in AGENT_ENTRIES:
        run([TOOLS_DIR / "log-agent.py", phase, step, fw, agent, parallel, notes])
    print()

    print("[plan] setting phase labels and completion dates in plan-data.json...")
    set_phase_labels_and_completion(regen_js)
    print()

    print("[render-check] verifying data files...")
    for phase in sorted(PHASE_LABELS):
        # exit 2 = warning (some steps have no actuals) — expected for in-progress phases
        run([TOOLS_DIR / "render-check.py", phase], ok_exits=(0, 2))
    print()

    # If DASHBOARD.html lives in a subdirectory (e.g. templates/ in the kit
    # repo), the browser resolves <script src=".claude/..."> relative to the
    # HTML file — so copy the JS files there too.
    dash_dirs = [p.parent for p in [Path("DASHBOARD.html"), Path("templates/DASHBOARD.html")] if p.exists()]
    js_files = ["time-log.js", "agents-log.js", "plan-data.js"]
    for dash_dir in dash_dirs:
        target_claude = dash_dir / ".claude"
        if dash_dir != Path("."):
            target_claude.mkdir(parents=True, exist_ok=True)
            import shutil
            for js in js_files:
                src = CLAUDE_DIR / js
                if src.exists():
                    shutil.copy2(src, target_claude / js)
            print(f"  copied JS data files -> {target_claude}/")

    if do_wizard_done or do_wizard_pending:
        print(f"[wizard] seeding wizard state ({'complete' if do_wizard_done else 'pending'})...")
        seed_wizard_state(done=do_wizard_done)
        print()

    print("Done. Open DASHBOARD.html to see the populated dashboard.")
    print("  Phase 1 — closed (auto-collapses), all 5 steps have actuals.")
    print("  Phase 2 — in progress, step 3 shows '—' (not yet logged).")
    print("  Agents tab — 11 spawns, 3 parallel groups.")
    if do_wizard_done:
        print("  Wizard banner — complete (all integrations done, project name set).")
    elif do_wizard_pending:
        print("  Wizard banner — in progress (all integrations pending).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
