#!/usr/bin/env bash
# Installs the weekly Supabase backup as a macOS LaunchAgent.
# Backups land in ~/Documents/rowan-backups/ as gzipped JSON, retained 26 weeks.

set -euo pipefail

LABEL="com.colinvinson.rowan-backup"
SRC="$(cd "$(dirname "$0")" && pwd)/${LABEL}.plist"
DEST="$HOME/Library/LaunchAgents/${LABEL}.plist"

case "${1-}" in
  --run-once)
    cd "$(cd "$(dirname "$0")" && pwd)/.." && ./node_modules/.bin/tsx scripts/backup.ts
    exit $?
    ;;
  --status)
    if launchctl list | grep -q "$LABEL"; then
      echo "  INSTALLED — $LABEL"
      launchctl list "$LABEL" | head -20
    else
      echo "  NOT INSTALLED — $LABEL"
    fi
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
launchctl unload "$DEST" 2>/dev/null || true
cp "$SRC" "$DEST"
launchctl load "$DEST"

echo "  Installed → $DEST"
echo "  Fires Sundays at 03:00. Backups land in ~/Documents/rowan-backups/"
echo "  Run once now:      ./scripts/install-backup.sh --run-once"
echo "  Status:            ./scripts/install-backup.sh --status"
echo "  Uninstall:         ./scripts/install-backup.sh --uninstall"
