#!/bin/bash
set -euo pipefail

payload="$(cat)"
tool_name="$(jq -r '.tool_name // ""' <<<"$payload")"

if [ "$tool_name" = "ExitPlanMode" ]; then
    ~/.claude/hooks/notify.sh "Claude Code" "Plan ready for approval"
else
    ~/.claude/hooks/notify.sh "Claude Code" "Approval needed"
fi
