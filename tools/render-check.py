#!/usr/bin/env python3
"""render-check.py — verify that the JSON data files are present and valid.

Usage:
  python tools/render-check.py <phase-id>

Checks:
  1. .claude/time-log.json exists and is valid JSON (a list).
  2. .claude/time-log.js exists and starts with "window.TIME_LOG_DATA".
  3. .claude/plan-data.json exists and is valid JSON (a dict).
  4. .claude/plan-data.js exists and starts with "window.PLAN_DATA".
  5. If phase-id is given and plan-data.json has that phase, every step in
     that phase has at least one logged actual in time-log.json.

Exit codes:
  0 = all checks pass
  1 = bad arguments / file not found / invalid format
  2 = phase has steps with no logged actual (cells will render as —)
"""

import json
import os
import sys
from pathlib import Path

os.environ.setdefault("PYTHONIOENCODING", "utf-8")
try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except (AttributeError, ValueError):
    pass

CLAUDE_DIR = Path(".claude")
TIME_LOG_JSON  = CLAUDE_DIR / "time-log.json"
TIME_LOG_JS    = CLAUDE_DIR / "time-log.js"
PLAN_DATA_JSON = CLAUDE_DIR / "plan-data.json"
PLAN_DATA_JS   = CLAUDE_DIR / "plan-data.js"


def check_file(path: Path, kind: str, starts_with: str | None = None):
    """Return parsed content or sys.exit(1) on failure. kind = 'json'|'js'."""
    if not path.exists():
        sys.stderr.write(f"ERROR: {path} not found. Run from the project root.\n")
        sys.exit(1)
    raw = path.read_text(encoding="utf-8").strip()
    if kind == "json":
        try:
            return json.loads(raw)
        except json.JSONDecodeError as e:
            sys.stderr.write(f"ERROR: {path} is not valid JSON: {e}\n")
            sys.exit(1)
    if kind == "js" and starts_with and not raw.startswith(starts_with):
        sys.stderr.write(
            f"ERROR: {path} does not start with '{starts_with}'. "
            f"Re-run the relevant log tool to regenerate it.\n"
        )
        sys.exit(1)
    return raw


def main(argv: list[str]) -> int:
    if len(argv) != 2:
        sys.stderr.write("usage: python tools/render-check.py <phase-id>\n")
        return 1

    phase = argv[1]

    # --- 1-4: structural checks ---
    time_log = check_file(TIME_LOG_JSON, "json")
    check_file(TIME_LOG_JS, "js", "window.TIME_LOG_DATA")
    plan_data = check_file(PLAN_DATA_JSON, "json")
    check_file(PLAN_DATA_JS, "js", "window.PLAN_DATA")

    if not isinstance(time_log, list):
        sys.stderr.write(f"ERROR: {TIME_LOG_JSON} must be a JSON array.\n")
        return 1
    if not isinstance(plan_data, dict):
        sys.stderr.write(f"ERROR: {PLAN_DATA_JSON} must be a JSON object.\n")
        return 1

    print(f"OK: data files present and valid JSON/JS.")

    # --- 5: per-phase actuals check ---
    if phase not in plan_data:
        print(f"NOTE: phase '{phase}' not yet in plan-data.json — no step check needed.")
        return 0

    steps = plan_data[phase].get("steps", [])
    if not steps:
        print(f"OK: phase '{phase}' has no steps in plan-data.json.")
        return 0

    logged = {
        (entry["phase"], str(entry["step"]))
        for entry in time_log
        if entry.get("phase") == phase and entry.get("notes", "").upper() != "START"
    }

    missing = []
    for s in steps:
        num = str(s.get("num", ""))
        if (phase, num) not in logged:
            missing.append(f"{phase}-{num}")

    if missing:
        print(
            f"WARN: phase {phase} has {len(missing)}/{len(steps)} step(s) "
            f"with no logged actual:"
        )
        for k in missing:
            print(f"  - {k}")
        print("These cells will render as '—' in DASHBOARD.html.")
        print(
            "Either log them via /log-time or note the gap in SPLIT-PLAN §5 "
            "(progress log)."
        )
        return 2

    print(f"OK: phase {phase} — all {len(steps)} step(s) have logged actuals.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
