#!/usr/bin/env python3
"""log-agent.py — append one agent-spawn row to .claude/agents-log.json,
regenerate .claude/agents-log.js, and append a human-readable row to AGENT-LOG.md.

Usage (spawn — called by PreToolUse hook):
  python tools/log-agent.py <phase> <step> <framework> <agent-name> <parallel:y/n> "<notes>"

Usage (complete — called by PostToolUse hook):
  python tools/log-agent.py --complete

  Pops the most recent entry from .claude/agent-in-flight.json, computes
  duration_ms from spawn time to now, and updates that agents-log entry.

Called automatically by .claude/hooks/log-agent-on-spawn.sh (spawn) and
.claude/hooks/log-agent-on-complete.sh (complete). Can also be invoked
manually via /log-agent for edge cases (MCP tools, etc.).

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

CLAUDE_DIR        = Path(".claude")
AGENTS_LOG_JSON   = CLAUDE_DIR / "agents-log.json"
AGENTS_LOG_JS     = CLAUDE_DIR / "agents-log.js"
AGENT_LOG_MD      = Path("AGENT-LOG.md")
IN_FLIGHT_FILE    = CLAUDE_DIR / "agent-in-flight.json"

HEADER = (
    "| Date | Phase | Step | Framework | AgentName | Parallel | Notes |\n"
    "| ---- | ----- | ---- | --------- | --------- | -------- | ----- |\n"
)

sys.path.insert(0, str(Path(__file__).parent))
from _data_js import regen_js  # noqa: E402


def _load_json(path: Path, default):
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    return default


def _write_json(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def _push_in_flight(idx: int, start_iso: str) -> None:
    stack: list = []
    if IN_FLIGHT_FILE.exists():
        try:
            stack = json.loads(IN_FLIGHT_FILE.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            stack = []
    stack.append({"idx": idx, "start_iso": start_iso})
    IN_FLIGHT_FILE.write_text(json.dumps(stack, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def _pop_in_flight() -> tuple[int, str] | None:
    if not IN_FLIGHT_FILE.exists():
        return None
    try:
        stack = json.loads(IN_FLIGHT_FILE.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return None
    if not stack:
        return None
    entry = stack.pop()
    IN_FLIGHT_FILE.write_text(json.dumps(stack, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return entry["idx"], entry["start_iso"]


def append_agents_log_json(
    phase: str, step: str, framework: str, agent_name: str,
    parallel: str, notes: str, now: str,
) -> int:
    entries = _load_json(AGENTS_LOG_JSON, [])
    idx = len(entries)
    entries.append({
        "datetime": now,
        "phase": phase,
        "step": step,
        "framework": framework,
        "agent_name": agent_name,
        "parallel": parallel.lower(),
        "notes": notes,
    })
    _write_json(AGENTS_LOG_JSON, entries)
    regen_js(AGENTS_LOG_JSON, AGENTS_LOG_JS, "AGENTS_LOG_DATA")
    print(f"  wrote agents-log.json + agents-log.js ({len(entries)} entries)")
    return idx


def complete_agent() -> int:
    """Pop in-flight stack, compute duration_ms, update the agents-log entry."""
    result = _pop_in_flight()
    if result is None:
        sys.stderr.write("WARNING: log-agent --complete: no in-flight entry to close\n")
        return 0
    idx, start_iso = result
    entries = _load_json(AGENTS_LOG_JSON, [])
    if idx >= len(entries):
        sys.stderr.write(f"WARNING: log-agent --complete: index {idx} out of range\n")
        return 0
    now_dt = _dt.datetime.now(_dt.timezone.utc)
    try:
        start_dt = _dt.datetime.fromisoformat(start_iso.replace("Z", "+00:00"))
    except ValueError:
        sys.stderr.write(f"WARNING: log-agent --complete: bad start_iso '{start_iso}'\n")
        return 0
    duration_ms = int((now_dt - start_dt).total_seconds() * 1000)
    end_iso = now_dt.strftime("%Y-%m-%dT%H:%M:%SZ")
    entries[idx]["end_time"] = end_iso
    entries[idx]["duration_ms"] = duration_ms
    _write_json(AGENTS_LOG_JSON, entries)
    regen_js(AGENTS_LOG_JSON, AGENTS_LOG_JS, "AGENTS_LOG_DATA")
    agent_name = entries[idx].get("agent_name", "?")
    print(f"✓ agent complete: {agent_name} idx={idx} duration={duration_ms / 1000:.1f}s", flush=True)
    return 0


def append_agent_log_md(
    phase: str, step: str, framework: str, agent_name: str,
    parallel: str, notes: str, now: str,
) -> None:
    row = (
        f"| {now} | {phase} | {step} | {framework} | {agent_name} "
        f"| {parallel} | {notes} |\n"
    )
    if not AGENT_LOG_MD.exists():
        AGENT_LOG_MD.write_text(
            "# AGENT-LOG.md — agent spawn audit log\n\n"
            "Appended automatically by `tools/log-agent.py`.\n"
            "**Do not edit manually.** Claude is the sole writer.\n\n"
            + HEADER,
            encoding="utf-8",
        )
    content = AGENT_LOG_MD.read_text(encoding="utf-8")
    if HEADER.splitlines()[0] not in content:
        content += "\n" + HEADER
    AGENT_LOG_MD.write_text(content + row, encoding="utf-8")
    print(f"  appended AGENT-LOG.md row: Phase {phase} step {step}")


def main(argv: list[str]) -> int:
    if len(argv) >= 2 and argv[1] == "--complete":
        return complete_agent()

    if len(argv) != 7:
        sys.stderr.write(
            "usage: python tools/log-agent.py <phase> <step> <framework> "
            "<agent-name> <parallel:y/n> <notes>\n"
            "       python tools/log-agent.py --complete\n"
        )
        return 1

    _, phase, step, framework, agent_name, parallel, notes = argv
    parallel = parallel.lower()
    if parallel not in ("y", "n"):
        sys.stderr.write(f"ERROR: parallel must be 'y' or 'n', got '{parallel}'\n")
        return 1
    if not notes.strip():
        sys.stderr.write("ERROR: notes must not be empty\n")
        return 1

    now = _dt.datetime.now(_dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    parallel_label = "parallel" if parallel == "y" else "sequential"
    print(
        f"[AGENT] Spawning agent: {framework}/{agent_name} "
        f"({parallel_label}) - phase={phase} step={step}"
    )

    idx = append_agents_log_json(phase, step, framework, agent_name, parallel, notes, now)
    append_agent_log_md(phase, step, framework, agent_name, parallel, notes, now)
    _push_in_flight(idx, now)

    print(
        f"✓ logged {framework}/{agent_name} phase={phase} step={step} parallel={parallel}",
        flush=True,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
