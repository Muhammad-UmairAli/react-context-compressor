#!/usr/bin/env python3
"""estimate.py — write (Baseline h, With-AI h) for a step into .claude/plan-data.json.

The /estimate slash command spawns the task-estimator subagent, parses
the subagent's JSON output, then calls this script with the resolved
values. Idempotent: re-running on the same (phase, step) updates the
existing entry's h_baseline / h_ai in place.

Usage:
  python tools/estimate.py <phase> <step> <baseline_h> <with_ai_h> "<description>"

Side effects:
  - Upserts step entry in .claude/plan-data.json with h_baseline and h_ai.
  - Regenerates .claude/plan-data.js (window.PLAN_DATA = {...}).
  - DASHBOARD.html is NOT modified. renderDynamicPhases() reads PLAN_DATA
    from plan-data.js and re-renders on next page load.

Exit codes:
  0 = wrote / updated the estimate
  1 = bad arguments
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
PLAN_DATA_JSON = CLAUDE_DIR / "plan-data.json"
PLAN_DATA_JS = CLAUDE_DIR / "plan-data.js"

sys.path.insert(0, str(Path(__file__).parent))
from _data_js import regen_js  # noqa: E402


def usage() -> None:
    sys.stderr.write(
        'usage: python tools/estimate.py <phase> <step> <baseline_h> <with_ai_h> "<description>"\n'
    )
    sys.exit(1)


def upsert_estimate(
    phase: str, step: str, baseline_h: float, with_ai_h: float, desc: str
) -> None:
    plan: dict = {}
    if PLAN_DATA_JSON.exists():
        try:
            plan = json.loads(PLAN_DATA_JSON.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            plan = {}

    step_entry = {
        "num": step,
        "name": desc,
        "h_baseline": baseline_h,
        "h_ai": with_ai_h,
    }

    if phase not in plan:
        plan[phase] = {"label": f"Phase {phase}", "steps": [step_entry]}
        print(f"  created Phase {phase} in plan-data.json with step {step}")
    else:
        steps = plan[phase].setdefault("steps", [])
        for i, s in enumerate(steps):
            if str(s.get("num", "")) == step:
                steps[i]["h_baseline"] = baseline_h
                steps[i]["h_ai"] = with_ai_h
                if not steps[i].get("name"):
                    steps[i]["name"] = desc
                print(f"  updated step {step} estimate in Phase {phase}: "
                      f"baseline={baseline_h:.2f} h, with_ai={with_ai_h:.2f} h")
                break
        else:
            steps.append(step_entry)
            print(f"  appended step {step} to Phase {phase}: "
                  f"baseline={baseline_h:.2f} h, with_ai={with_ai_h:.2f} h")

    PLAN_DATA_JSON.parent.mkdir(parents=True, exist_ok=True)
    PLAN_DATA_JSON.write_text(
        json.dumps(plan, indent=2, ensure_ascii=True) + "\n", encoding="utf-8"
    )
    regen_js(PLAN_DATA_JSON, PLAN_DATA_JS, "PLAN_DATA")
    print("  regenerated plan-data.js")


def main(argv: list[str]) -> int:
    if len(argv) != 6:
        usage()
    _, phase, step, baseline_str, with_ai_str, desc = argv
    try:
        baseline_h = float(baseline_str)
        with_ai_h = float(with_ai_str)
    except ValueError:
        sys.stderr.write(
            f"ERROR: baseline / with-AI hours must be numbers; "
            f"got '{baseline_str}', '{with_ai_str}'\n"
        )
        return 1
    if baseline_h < 0 or with_ai_h < 0:
        sys.stderr.write("ERROR: hours must be non-negative\n")
        return 1
    if not desc.strip():
        sys.stderr.write("ERROR: description must not be empty\n")
        return 1

    upsert_estimate(phase, step, baseline_h, with_ai_h, desc)

    print(
        f"✓ estimate for Phase {phase} step {step}: "
        f"baseline {baseline_h:.2f} h / with-AI {with_ai_h:.2f} h",
        flush=True,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
