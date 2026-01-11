#!/bin/bash
# Unified notification script - works on host (terminal-notifier) and in devcontainers (ntfy.sh)

set -euo pipefail

TITLE="${1:-Claude Code}"
MESSAGE="${2:-Notification}"

# Change this to your own unique topic!
NTFY_TOPIC="claude-vcheng-notify"

if command -v terminal-notifier &>/dev/null; then
    terminal-notifier -title "$TITLE" -message "$MESSAGE" -sound default
else
    # Fallback to ntfy.sh for devcontainers
    curl -s -d "$MESSAGE" "ntfy.sh/$NTFY_TOPIC" >/dev/null 2>&1 || true
fi
