#!/usr/bin/env bash
# render-check.sh — thin wrapper around tools/render-check.py.
#
# Verifies that every step of a phase has an actual value logged in
# DASHBOARD.html's inline JSON. Fails (exit 2) if any step in the
# requested phase has a `data-actual` cell in DASHBOARD.html but no
# matching `by_step` entry in the inline JSON. That mismatch is what
# causes `—` to render in the Actual / Difference columns.
#
# Usage:  ./tools/render-check.sh <phase-id>
# Example:./tools/render-check.sh 0
#
# The Python script does the actual work — keeping it in Python avoids
# bash dependency issues on Windows (where /bin/bash may resolve to a
# broken WSL stub).
#
# See docs/methodology/02-time-tracking-and-estimates.md.

set -euo pipefail

find_python() {
  for cmd in python3 python py; do
    if command -v "$cmd" >/dev/null 2>&1 && "$cmd" -c "" 2>/dev/null; then
      printf '%s' "$cmd"; return 0
    fi
  done
  echo "ERROR: no working python3/python/py found on PATH" >&2; return 1
}

exec "$(find_python)" "$(dirname "$0")/render-check.py" "$@"
