#!/usr/bin/env python3
"""open-phase.py — formally open Phase N.

Adds an in-flight row to SPLIT-PLAN §5 (progress log), creates a
docs/phases/phase-NNN.md skeleton, then invokes log-time.py to record
the phase opening as Phase N step 0.

This is the canonical "open a phase" entry point. Skipping it and
starting phase work directly is the bug that caused the
lacrosse-stick-tracker test session's CCPM decomposition to go
untracked.

Usage:
  python tools/open-phase.py <phase> "<short title>"

Example:
  python tools/open-phase.py 1 "lacrosse-stick-tracker build"
  python tools/open-phase.py 1.4.0 "billing UI release"
  python tools/open-phase.py am-3 "Aaron Mitchell sync 3"

Exit codes:
  0 = phase opened + logged
  1 = bad arguments / phase already in flight
  2 = log-time.py failed
"""

import datetime as _dt
import json
import os
import re
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from _data_js import regen_js  # noqa: E402

os.environ.setdefault("PYTHONIOENCODING", "utf-8")
try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except (AttributeError, ValueError):
    pass

SPLIT_PLAN = Path("SPLIT-PLAN.md")
PHASE_DOCS_DIR = Path("docs/phases")


def usage() -> None:
    sys.stderr.write(
        'usage: python tools/open-phase.py <phase> "<short title>"\n'
    )
    sys.exit(1)


def phase_doc_filename(phase: str) -> str:
    """Pad numeric phase ids to 3 digits (1 → phase-001.md). Non-numeric
    phase ids (am-3, 1.4.0) get a sanitized direct mapping."""
    if re.fullmatch(r"\d+", phase):
        return f"phase-{int(phase):03d}.md"
    safe = re.sub(r"[^A-Za-z0-9._-]", "_", phase)
    return f"phase-{safe}.md"


def phase_already_open(phase: str) -> bool:
    """Return True if SPLIT-PLAN §5 already has an unclosed row for this phase."""
    if not SPLIT_PLAN.exists():
        return False
    text = SPLIT_PLAN.read_text(encoding="utf-8")
    # Look for "Phase <phase> —" in any §8/§5 row.
    pattern = re.compile(
        rf"^\|.*\|\s*Phase\s+{re.escape(phase)}\s*[—-].*\|.*IN FLIGHT.*\|",
        re.MULTILINE,
    )
    return bool(pattern.search(text))


def add_split_plan_row(phase: str, title: str) -> None:
    if not SPLIT_PLAN.exists():
        sys.exit(f"ERROR: {SPLIT_PLAN} not found. Run from the project root.")
    text = SPLIT_PLAN.read_text(encoding="utf-8")

    # Find the §5 (progress log) section and append a row before the
    # next ## heading.
    progress_section = re.compile(
        r"(##\s*§5.*?\n.*?\n)(?=\n*##|\Z)",
        re.DOTALL,
    )
    m = progress_section.search(text)
    if not m:
        sys.exit("ERROR: could not locate ## §5 section in SPLIT-PLAN.md")

    today = _dt.date.today().isoformat()
    new_row = (
        f"| {today} | Phase {phase} — {title} | IN FLIGHT | "
        f"(will be filled in at close) |\n"
    )

    section_text = m.group(1)
    if not section_text.endswith("\n"):
        section_text += "\n"
    new_section = section_text + new_row
    text = text[: m.start()] + new_section + text[m.end():]
    SPLIT_PLAN.write_text(text, encoding="utf-8")
    print(f"  added SPLIT-PLAN §5 (progress log) row: Phase {phase} — {title}", flush=True)


def create_phase_doc(phase: str, title: str) -> Path:
    PHASE_DOCS_DIR.mkdir(parents=True, exist_ok=True)
    fname = phase_doc_filename(phase)
    path = PHASE_DOCS_DIR / fname
    if path.exists():
        print(f"  phase doc already exists: {path}", flush=True)
        return path

    today = _dt.date.today().isoformat()
    content = f"""# Phase {phase} — {title}

**Date opened:** {today}
**Status:** IN FLIGHT

## Scope

<!-- One paragraph describing what this phase delivers. Reference
SPLIT-PLAN §1 (goals) or SPLIT-PLAN §6 (backlog) if applicable. -->

## Deliverables

- [ ] Mergeable PR(s) closing the linked GitHub Issue(s)
- [ ] TIME-LOG.md rows logged for each substantive step (via /log-time)
- [ ] DASHBOARD.html updated with rows for every step (auto via /log-time)
- [ ] Closure log appended below at phase close

## Plan

<!-- Step-by-step plan. Each step gets its own /log-time entry as it
completes. -->

## Closure log

<!-- Filled in when the phase closes. Date closed, Issue/PR numbers,
what shipped, files NOT touched, sanity checks, what this unblocks. -->
"""
    path.write_text(content, encoding="utf-8")
    print(f"  created phase doc: {path}", flush=True)
    return path


def set_phase_label(phase: str, title: str) -> None:
    """Write the human-readable title into plan-data.json so the dashboard
    Phase Log and Agent Log pages display the full phase name."""
    plan_json = Path(".claude/plan-data.json")
    plan_js   = Path(".claude/plan-data.js")
    if not plan_json.exists():
        return
    plan = json.loads(plan_json.read_text(encoding="utf-8"))
    if phase in plan:
        plan[phase]["label"] = title
        plan_json.write_text(json.dumps(plan, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        regen_js(plan_json, plan_js, "PLAN_DATA")
        print(f"  updated plan-data.json label for Phase {phase}: {title!r}", flush=True)


def main(argv: list[str]) -> int:
    if len(argv) != 3:
        usage()
    _, phase, title = argv
    if not phase or not title.strip():
        usage()

    if phase_already_open(phase):
        sys.stderr.write(
            f"ERROR: Phase {phase} is already open in SPLIT-PLAN §5 "
            f"(progress log). Use /work-the-phase to continue, or "
            f"/log-time to log work.\n"
        )
        return 1

    add_split_plan_row(phase, title)
    create_phase_doc(phase, title)

    # Log the opening as Phase N step 0.
    notes = (
        f"Phase {phase} opened — SPLIT-PLAN §5 (progress log) + "
        f"docs/phases/{phase_doc_filename(phase)} skeleton"
    )
    log_cmd = [
        "python",
        "tools/log-time.py",
        phase,
        "0",
        "0.05",
        notes,
    ]
    rc = subprocess.run(log_cmd, check=False)
    if rc.returncode != 0:
        sys.stderr.write(
            f"ERROR: log-time.py failed (exit {rc.returncode}). "
            f"SPLIT-PLAN row + phase doc were created but logging failed.\n"
        )
        return 2

    set_phase_label(phase, title)

    print(f"\n✓ Phase {phase} is open. Log subsequent work via /log-time.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
