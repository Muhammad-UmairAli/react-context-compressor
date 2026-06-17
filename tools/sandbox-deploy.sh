#!/usr/bin/env bash
# sandbox-deploy.sh — rebuild and redeploy a sandbox container after code changes.
#
# Usage: tools/sandbox-deploy.sh <slug>
#
# <slug> is the short local name chosen when running /init-sandbox
# (e.g. `tools/sandbox-deploy.sh prototype`).
#
# Reads .claude/sandbox-{slug}.json for the Azure resource names set during
# /init-sandbox. Rebuilds the image via az containerapp up --source and opens
# the browser when done.

set -euo pipefail

SLUG="${1:-}"
if [[ -z "$SLUG" ]]; then
  echo "Usage: tools/sandbox-deploy.sh <slug>" >&2
  echo "  <slug> is the local sandbox name set during /init-sandbox" >&2
  echo "  Available configs:" >&2
  ls .claude/sandbox-*.json 2>/dev/null | sed 's|.claude/sandbox-||;s|\.json||;s|^|    |' || true
  exit 1
fi

CONFIG=".claude/sandbox-${SLUG}.json"
if [[ ! -f "$CONFIG" ]]; then
  echo "ERROR: $CONFIG not found." >&2
  echo "       Run /init-sandbox first, or check the slug name." >&2
  exit 1
fi

if ! command -v az >/dev/null 2>&1; then
  echo "ERROR: 'az' CLI not found. Install the Azure CLI and re-run." >&2
  exit 1
fi

# Load config
APP_NAME=$(python3 -c "import json; d=json.load(open('${CONFIG}')); print(d['app_name'])")
RG=$(python3 -c "import json; d=json.load(open('${CONFIG}')); print(d['resource_group'])")
ENV_NAME=$(python3 -c "import json; d=json.load(open('${CONFIG}')); print(d['env_name'])")
MIN_REPLICAS=$(python3 -c "import json; d=json.load(open('${CONFIG}')); print(d.get('min_replicas', 0))")
SOURCE_DIR="sandboxes/${SLUG}"

if [[ ! -d "$SOURCE_DIR" ]]; then
  echo "ERROR: $SOURCE_DIR not found in project root." >&2
  echo "       Was the sandbox directory moved or deleted?" >&2
  exit 1
fi

echo "Rebuilding and redeploying '$APP_NAME' (slug: $SLUG) to resource group '$RG'..."
echo ""

URL=$(az containerapp up \
  --name "$APP_NAME" \
  --resource-group "$RG" \
  --environment "$ENV_NAME" \
  --source "./$SOURCE_DIR" \
  --ingress external \
  --target-port 3000 \
  --min-replicas "$MIN_REPLICAS" \
  --max-replicas 1 \
  --query properties.configuration.ingress.fqdn \
  --output tsv 2>&1 | tail -1)

if [[ -z "$URL" ]]; then
  URL=$(az containerapp show \
    --name "$APP_NAME" \
    --resource-group "$RG" \
    --query properties.configuration.ingress.fqdn \
    --output tsv)
fi

FULL_URL="https://${URL}"
echo ""
echo "✓ Redeployment complete: $FULL_URL"
echo ""

# Open browser
case "$(uname -s)" in
  Darwin) open "$FULL_URL" ;;
  Linux)  xdg-open "$FULL_URL" 2>/dev/null || true ;;
  MINGW*|MSYS*|CYGWIN*) start "$FULL_URL" ;;
  *) echo "Open manually: $FULL_URL" ;;
esac
