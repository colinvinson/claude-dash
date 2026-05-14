#!/usr/bin/env bash
# Installs the Jarvis bridge as a macOS LaunchAgent so it auto-starts at login,
# stays running across terminal closes, and auto-restarts on crash.
#
# Usage:
#   ./scripts/install-bridge.sh           # install + start
#   ./scripts/install-bridge.sh --status  # check
#   ./scripts/install-bridge.sh --stop    # unload (one-time stop)
#   ./scripts/install-bridge.sh --uninstall  # remove the LaunchAgent entirely
#
# Logs tail at .jarvis-bridge.log in the project root.

set -euo pipefail

LABEL="com.colinvinson.jarvis-bridge"
SRC="$(cd "$(dirname "$0")" && pwd)/${LABEL}.plist"
DEST="$HOME/Library/LaunchAgents/${LABEL}.plist"

case "${1-}" in
  --status)
    if launchctl list | grep -q "$LABEL"; then
      echo "  RUNNING — $LABEL"
      launchctl list "$LABEL" | head -20
    else
      echo "  NOT RUNNING — $LABEL"
    fi
    exit 0
    ;;
  --stop)
    launchctl unload "$DEST" 2>/dev/null && echo "Stopped." || echo "Not loaded."
    exit 0
    ;;
  --uninstall)
    launchctl unload "$DEST" 2>/dev/null || true
    rm -f "$DEST"
    echo "Removed $DEST"
    exit 0
    ;;
esac

mkdir -p "$HOME/Library/LaunchAgents"

# Replace existing plist + reload. launchctl bootstrap is the modern API but
# `unload` + `load` works everywhere and is forgiving on re-runs.
launchctl unload "$DEST" 2>/dev/null || true
cp "$SRC" "$DEST"
launchctl load "$DEST"

echo "  Installed → $DEST"
echo "  Tail logs: tail -f /Users/colinvinson/rowan-dashboard/.jarvis-bridge.log"
echo "  Status:    ./scripts/install-bridge.sh --status"
echo "  Stop:      ./scripts/install-bridge.sh --stop"
