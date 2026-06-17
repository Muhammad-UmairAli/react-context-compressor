#!/usr/bin/env python3
"""log-time.py — append a time-log entry to .claude/time-log.json, upsert the
step estimate in .claude/plan-data.json, regenerate the matching JS files, and
append a human-readable row to TIME-LOG.md.

This is the canonical "log a step" entry point. The /log-time slash command
calls this; Claude shouldn't manually edit any data files when /log-time is
the right tool.

Usage:
  python tools/log-time.py <phase> <step> <hours> "<notes>"

Side effects:
  - Appends entry to .claude/time-log.json.
  - Regenerates .claude/time-log.js (window.TIME_LOG_DATA = [...]).
  - Upserts step estimate in .claude/plan-data.json.
  - Regenerates .claude/plan-data.js (window.PLAN_DATA = {...}).
  - Appends a row to TIME-LOG.md (human-readable output only).

Exit codes:
  0 = success
  1 = bad arguments or missing files

See docs/methodology/02-time-tracking-and-estimates.md.
"""

import datetime as _dt
import json
import os
import sys
from pathlib import Path

# Force UTF-8 stdout/stderr regardless of locale so § and — render
# correctly on Windows/CP1252 terminals.
os.environ.setdefault("PYTHONIOENCODING", "utf-8")
try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except (AttributeError, ValueError):
    pass

# .claude/ data files (relative to project root)
CLAUDE_DIR = Path(".claude")
TIME_LOG_JSON  = CLAUDE_DIR / "time-log.json"
TIME_LOG_JS    = CLAUDE_DIR / "time-log.js"
PLAN_DATA_JSON = CLAUDE_DIR / "plan-data.json"
PLAN_DATA_JS   = CLAUDE_DIR / "plan-data.js"
TIMER_FILE     = CLAUDE_DIR / "task-timer.json"
AGENTS_LOG_JSON = CLAUDE_DIR / "agents-log.json"
TIME_LOG_MD    = Path("TIME-LOG.md")

# Import shared JS-regen helper from the same tools/ directory.
sys.path.insert(0, str(Path(__file__).parent))
from _data_js import regen_js  # noqa: E402


def usage() -> None:
    sys.stderr.write(
        'usage: python tools/log-time.py <phase> <step> <hours> "<notes>"\n'
    )
    sys.exit(1)


def _load_json(path: Path, default):
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    return default


def _write_json(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def append_time_log_json(phase: str, step: str, actual_hours: float, notes: str) -> None:
    entries = _load_json(TIME_LOG_JSON, [])
    now = _dt.datetime.now(_dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    entries.append({
        "datetime": now,
        "phase": phase,
        "step": step,
        "hours": actual_hours,
        "who": "claude",
        "notes": notes,
    })
    _write_json(TIME_LOG_JSON, entries)
    regen_js(TIME_LOG_JSON, TIME_LOG_JS, "TIME_LOG_DATA")
    print(f"  wrote time-log.json + time-log.js ({len(entries)} entries)")


def _agent_actual_hours(phase: str, step: str) -> float | None:
    """Return sum of agent duration_ms for this phase/step, in hours. None if no data."""
    if not AGENTS_LOG_JSON.exists():
        return None
    try:
        entries = json.loads(AGENTS_LOG_JSON.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return None
    total_ms = sum(
        e.get("duration_ms", 0)
        for e in entries
        if str(e.get("phase", "")) == phase
        and str(e.get("step", "")) == step
        and e.get("duration_ms")
    )
    return total_ms / 3_600_000.0 if total_ms > 0 else None


def upsert_plan_data(phase: str, step: str, hours: float, notes: str) -> None:
    plan = _load_json(PLAN_DATA_JSON, {})
    step_entry = {
        "num": step,
        "name": notes,
        "h_baseline": hours,
        "h_ai": hours,
    }
    if phase not in plan:
        plan[phase] = {"label": f"Phase {phase}", "steps": [step_entry]}
        print(f"  created Phase {phase} in plan-data.json")
    else:
        steps = plan[phase].setdefault("steps", [])
        num = step_entry["num"]
        for i, s in enumerate(steps):
            if str(s.get("num", "")) == num:
                # estimate.py owns h_baseline and h_ai — never overwrite them here.
                # Only set as a fallback if neither was ever written (both are falsy/zero).
                if not steps[i].get("h_baseline") and not steps[i].get("h_ai"):
                    steps[i]["h_baseline"] = hours
                    steps[i]["h_ai"] = hours
                if not steps[i].get("name"):
                    steps[i]["name"] = notes
                print(f"  preserved step {step} estimates in Phase {phase}")
                break
        else:
            steps.append(step_entry)
            print(f"  appended step {step} to Phase {phase} in plan-data.json")
    _write_json(PLAN_DATA_JSON, plan)
    regen_js(PLAN_DATA_JSON, PLAN_DATA_JS, "PLAN_DATA")
    print(f"  regenerated plan-data.js")


def append_time_log_md(phase: str, step: str, actual_hours: float, notes: str) -> None:
    if not TIME_LOG_MD.exists():
        sys.exit(f"ERROR: {TIME_LOG_MD} not found. Run from the project root.")
    today = _dt.date.today().isoformat()
    row = f"| {today} | {phase} | {step} | {actual_hours:.4f} | claude | {notes} |\n"
    with TIME_LOG_MD.open("a", encoding="utf-8") as f:
        f.write(row)
    print(f"  appended TIME-LOG.md row: Phase {phase} step {step}, {actual_hours:.4f} h")


def main(argv: list[str]) -> int:
    if len(argv) != 5:
        usage()
    _, phase, step, hours_str, notes = argv
    try:
        hours = float(hours_str)
    except ValueError:
        sys.stderr.write(f"ERROR: hours '{hours_str}' is not a valid number\n")
        return 1
    if hours < 0:
        sys.stderr.write("ERROR: hours must be non-negative\n")
        return 1
    if not notes.strip():
        sys.stderr.write("ERROR: notes must not be empty\n")
        return 1

    # Determine actual hours.
    # Priority: (1) /start-task wall-clock timer, (2) sum of agent durations,
    # (3) warn and fall back to the passed estimate.
    key = f"{phase}-{step}"
    actual_hours = hours
    timer_used = False
    if TIMER_FILE.exists():
        try:
            timer_data = json.loads(TIMER_FILE.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            timer_data = {}
        if key in timer_data:
            entry = timer_data[key]
            started_at = _dt.datetime.fromisoformat(entry["started_at"])
            now = _dt.datetime.now(_dt.timezone.utc)
            elapsed = (now - started_at).total_seconds() / 3600.0
            actual_hours = min(elapsed, 8.0)
            timer_used = True
            del timer_data[key]
            TIMER_FILE.write_text(json.dumps(timer_data, indent=2), encoding="utf-8")
            print(f"  timer stopped for {key}: {actual_hours:.4f} h elapsed (capped at 8 h)")

    if not timer_used:
        agent_h = _agent_actual_hours(phase, step)
        if agent_h is not None:
            actual_hours = agent_h
            print(f"  no timer — using sum of agent durations for {key}: {actual_hours:.4f} h")
        else:
            sys.stderr.write(
                f"WARNING: no /start-task timer or agent durations found for {key}.\n"
                f"  actual_hours will equal the estimate ({hours} h) — NOT real elapsed time.\n"
                f"  Always call /start-task <phase> <step> before beginning work so\n"
                f"  /log-time can read true wall-clock elapsed time.\n"
            )

    append_time_log_json(phase, step, actual_hours, notes)
    upsert_plan_data(phase, step, hours, notes)
    append_time_log_md(phase, step, actual_hours, notes)

    print(f"✓ logged Phase {phase} step {step} ({hours} h est / {actual_hours:.4f} h actual)", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
