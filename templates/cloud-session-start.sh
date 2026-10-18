#!/bin/sh
# SessionStart hook for cloud sessions (registered in .claude/settings.json). The environment
# cache keeps files and data directories but not running processes, so the database that the
# setup script prepared is started again here. Project-owned: adapt it to the project.
[ -n "$CLAUDE_CODE_REMOTE_SESSION_ID" ] || exit 0
service postgresql start >/dev/null 2>&1 || true
exit 0
