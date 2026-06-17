---
description: Record a task start timestamp in .claude/task-timer.json
argument-hint: '<phase> <step> "<description>"'
---

# /start-task

Record the wall-clock start of a task so `tools/log-time.py` can calculate real elapsed time when the task finishes.

## Usage

```
/start-task <phase> <step> "<description>"
```

## What this does

1. Writes a timer entry to `.claude/task-timer.json` keyed by `"<phase>-<step>"` with the UTC start timestamp and description.

## When to call

Call this at the very beginning of each task in `/work-the-phase`, before any code is written or commands are run. The matching `/log-time` call at task finish automatically reads the timer and records real elapsed hours instead of the CCPM estimate.

## Example

```
/start-task 2 1 "Issue #16 — auth middleware"
```

## Implementation

```bash
python tools/start-task.py <phase> <step> "<description>"
```
