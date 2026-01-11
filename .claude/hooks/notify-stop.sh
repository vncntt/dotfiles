#!/bin/bash
set -euo pipefail

payload="$(cat)"
mode="$(jq -r '.permission_mode // "default"' <<<"$payload")"

if [ "$mode" = "plan" ]; then
    ~/.claude/hooks/notify.sh "Claude Code" "Plan ready for approval"
else
    ~/.claude/hooks/notify.sh "Claude Code" "Done — waiting for your next prompt"
fi
