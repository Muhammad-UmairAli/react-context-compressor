#!/usr/bin/env python3
"""start-task.py — record task start timestamp in .claude/task-timer.json.

Usage:
  python tools/start-task.py <phase> <step> "<description>"

Side effects:
  - Writes/updates .claude/task-timer.json with a timer entry keyed by
    "<phase>-<step>". The file is a JSON dict so multiple tasks can run
    in parallel without clobbering each other.

When /log-time is called to close the task, it reads the timer entry,
computes elapsed hours, and appends the result to .claude/time-log.json.

See docs/methodology/02-time-tracking-and-estimates.md.
"""

import datetime as _dt
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

TIMER_FILE = Path(".claude/task-timer.json")


def usage() -> None:
    sys.stderr.write(
        'usage: python tools/start-task.py <phase> <step> "<description>"\n'
    )
    sys.exit(1)


def main(argv: list[str]) -> int:
    if len(argv) != 4:
        usage()
    _, phase, step, description = argv
    if not description.strip():
        sys.stderr.write("ERROR: description must not be empty\n")
        return 1

    key = f"{phase}-{step}"
    now = _dt.datetime.now(_dt.timezone.utc).isoformat()

    # Write timer entry — read-modify-write for parallel-task safety.
    TIMER_FILE.parent.mkdir(parents=True, exist_ok=True)
    timer_data: dict = {}
    if TIMER_FILE.exists():
        try:
            timer_data = json.loads(TIMER_FILE.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            timer_data = {}
    timer_data[key] = {"started_at": now, "description": description}
    TIMER_FILE.write_text(json.dumps(timer_data, indent=2), encoding="utf-8")

    print(f"✓ task {key} started — timer running", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
