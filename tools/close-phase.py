#!/usr/bin/env python3
"""close-phase.py — formally close Phase N.

Marks Phase N as completed:
1. Writes `completed: <YYYY-MM-DD>` into .claude/plan-data.json for the
   phase (and regenerates .claude/plan-data.js). The dashboard JS reads
   PLAN_DATA[phase].completed to auto-collapse the phase block on load.
2. Updates the SPLIT-PLAN §5 (progress log) row from "IN FLIGHT" to a
   closure summary the caller provides.
3. Updates docs/phases/phase-NNN.md `Status: IN FLIGHT` → `Status: CLOSED`
   and (optionally) appends a Closure log section.
4. Runs render-check.py so the dashboard reflects the new state.

Usage:
  python tools/close-phase.py <phase> "<closure-summary>"

Example:
  python tools/close-phase.py 1 "Lacrosse stick tracker shipped — all 6 task PRs merged, deployed to UAT"

Exit codes:
  0 = closed cleanly
  1 = bad args / phase not in flight / file missing
  2 = render-check failed downstream
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
CLAUDE_DIR = Path(".claude")
PLAN_DATA_JSON = CLAUDE_DIR / "plan-data.json"
PLAN_DATA_JS = CLAUDE_DIR / "plan-data.js"


def usage() -> None:
    sys.stderr.write(
        'usage: python tools/close-phase.py <phase> "<closure-summary>"\n'
    )
    sys.exit(1)


def phase_doc_filename(phase: str) -> str:
    if re.fullmatch(r"\d+", phase):
        return f"phase-{int(phase):03d}.md"
    safe = re.sub(r"[^A-Za-z0-9._-]", "_", phase)
    return f"phase-{safe}.md"


def mark_phase_completed(phase: str, date_iso: str) -> None:
    """Set plan-data.json[phase].completed = date_iso and regenerate plan-data.js."""
    plan: dict = {}
    if PLAN_DATA_JSON.exists():
        try:
            plan = json.loads(PLAN_DATA_JSON.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            plan = {}
    if phase not in plan:
        plan[phase] = {"label": f"Phase {phase}", "steps": []}
    plan[phase]["completed"] = date_iso
    PLAN_DATA_JSON.parent.mkdir(parents=True, exist_ok=True)
    PLAN_DATA_JSON.write_text(json.dumps(plan, indent=2, ensure_ascii=True) + "\n", encoding="utf-8")
    regen_js(PLAN_DATA_JSON, PLAN_DATA_JS, "PLAN_DATA")
    print(f"  marked Phase {phase} completed ({date_iso}) in plan-data.json")


def update_split_plan(phase: str, summary: str, date_iso: str) -> bool:
    """Find Phase N's IN FLIGHT row and replace with closure summary.
    Returns True if a row was updated, False if no in-flight row found."""
    if not SPLIT_PLAN.exists():
        sys.exit(f"ERROR: {SPLIT_PLAN} not found.")

    text = SPLIT_PLAN.read_text(encoding="utf-8")

    # Match the in-flight row for this phase.
    inflight_pat = re.compile(
        rf"^(\|\s*)(\S+)(\s*\|\s*Phase\s+{re.escape(phase)}\s*[—-][^|]*\|)\s*IN FLIGHT\s*\|[^|]*\|\s*$",
        re.MULTILINE,
    )
    m = inflight_pat.search(text)
    if not m:
        return False

    # Build replacement: keep the date column + phase column, replace last two cells.
    def replace(match: re.Match) -> str:
        return f"{match.group(1)}{date_iso}{match.group(3)} {summary} | (closed) |"

    text = inflight_pat.sub(replace, text, count=1)
    SPLIT_PLAN.write_text(text, encoding="utf-8")
    print(
        f"  updated SPLIT-PLAN §5 (progress log) row: Phase {phase} → {summary[:60]}..."
        if len(summary) > 60 else
        f"  updated SPLIT-PLAN §5 (progress log) row: Phase {phase} → {summary}"
    )
    return True


def update_phase_doc(phase: str, summary: str, date_iso: str) -> None:
    fname = phase_doc_filename(phase)
    path = PHASE_DOCS_DIR / fname
    if not path.exists():
        print(f"  phase doc not found at {path}; skipping closure-log update")
        return

    text = path.read_text(encoding="utf-8")
    # Flip Status line.
    text = re.sub(r"\*\*Status:\*\*\s*IN FLIGHT", f"**Status:** CLOSED ({date_iso})", text, count=1)

    # Append closure log content if the section exists.
    closure_pat = re.compile(r"(##\s*Closure log\s*\n)(.*?)$", re.DOTALL)
    cm = closure_pat.search(text)
    if cm:
        existing = cm.group(2)
        if "<!-- Filled in" in existing:
            # Replace the placeholder with real content.
            new_log = f"\n**Closed:** {date_iso}\n\n{summary}\n"
            text = text[: cm.start(2)] + new_log + text[cm.end(2):]
            print(f"  populated phase doc closure log")
        else:
            # Append a dated entry.
            text = (
                text[: cm.end(2)].rstrip()
                + f"\n\n**Closed:** {date_iso}\n\n{summary}\n"
            )
            print(f"  appended to phase doc closure log")
    path.write_text(text, encoding="utf-8")


def main(argv: list[str]) -> int:
    if len(argv) != 3:
        usage()
    _, phase, summary = argv
    if not phase or not summary.strip():
        usage()

    today = _dt.date.today().isoformat()

    # 1. Update SPLIT-PLAN row (refuses if no in-flight row exists).
    updated = update_split_plan(phase, summary, today)
    if not updated:
        sys.stderr.write(
            f"ERROR: no in-flight row for Phase {phase} found in SPLIT-PLAN §5 "
            f"(progress log). Was the phase opened via /open-phase?\n"
        )
        return 1

    # 2. Mark phase complete in plan-data.json (dashboard reads PLAN_DATA[phase].completed).
    mark_phase_completed(phase, today)

    # 3. Update phase doc.
    update_phase_doc(phase, summary, today)

    # 4. Render-check.
    sys.stdout.flush()
    rcheck = subprocess.run(["python", "tools/render-check.py", phase], check=False)
    if rcheck.returncode != 0:
        return 2

    print(
        f"\n✓ Phase {phase} closed. The dashboard now shows the actual finish "
        f"date and the phase auto-collapses on load.",
        flush=True,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
