#!/usr/bin/env bash
# sandbox-destroy.sh — delete all Azure resources created by /init-sandbox.
#
# WARNING: This deletes the entire resource group and everything in it.
# All running containers and data will be permanently lost.
#
# Usage: tools/sandbox-destroy.sh <slug>
#
# <slug> is the short local name chosen when running /init-sandbox
# (e.g. `tools/sandbox-destroy.sh prototype`).

set -euo pipefail

SLUG="${1:-}"
if [[ -z "$SLUG" ]]; then
  echo "Usage: tools/sandbox-destroy.sh <slug>" >&2
  echo "  <slug> is the local sandbox name set during /init-sandbox" >&2
  echo "  Available configs:" >&2
  ls .claude/sandbox-*.json 2>/dev/null | sed 's|.claude/sandbox-||;s|\.json||;s|^|    |' || true
  exit 1
fi

CONFIG=".claude/sandbox-${SLUG}.json"
if [[ ! -f "$CONFIG" ]]; then
  echo "ERROR: $CONFIG not found — nothing to destroy." >&2
  exit 1
fi

if ! command -v az >/dev/null 2>&1; then
  echo "ERROR: 'az' CLI not found." >&2
  exit 1
fi

RG=$(python3 -c "import json; d=json.load(open('${CONFIG}')); print(d['resource_group'])")
APP_NAME=$(python3 -c "import json; d=json.load(open('${CONFIG}')); print(d['app_name'])")

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  SANDBOX DESTROY"
echo "  Slug           : $SLUG"
echo "  Resource group : $RG"
echo "  App            : $APP_NAME"
echo "  WARNING        : This is irreversible."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [[ -t 0 ]]; then
  read -rp "Type the resource group name to confirm deletion: " CONFIRM
  if [[ "$CONFIRM" != "$RG" ]]; then
    echo "Name did not match — aborting." >&2
    exit 1
  fi
else
  echo "ERROR: stdin is not a terminal. Run this script interactively." >&2
  exit 1
fi

echo ""
echo "Deleting resource group '$RG'..."
az group delete --name "$RG" --yes --no-wait
echo "✓ Deletion queued. The resource group will be removed within a few minutes."
echo ""
echo "You can safely delete $CONFIG and sandboxes/$SLUG/ when you no longer need them."
