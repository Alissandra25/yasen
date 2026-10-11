#!/usr/bin/env bash
# PreToolUse (Edit|Write|MultiEdit): block edits to secrets and to committed migrations.
# Exit 2 blocks the tool call; stderr is shown to Claude.
source "$(dirname "$0")/lib.sh"

file="$(json_field tool_input.file_path)"
[ -z "$file" ] && exit 0
rel="$(rel_path "$file")"
base="$(basename "$rel")"

# Secrets: .env, .env.local, .env.production … (but .env.example is fine)
if [[ "$base" == .env* && "$base" != ".env.example" ]]; then
  echo "Blocked: $rel holds secrets. Ask the user to change it themselves." >&2
  exit 2
fi

# Committed migrations are immutable.
if [[ "$rel" == drizzle/* ]]; then
  if git -C "$PROJECT_DIR" ls-files --error-unmatch "$rel" >/dev/null 2>&1; then
    echo "Blocked: $rel is a committed migration. Never edit applied migrations — change src/db/schema and run npm run db:generate (see the db-migration skill)." >&2
    exit 2
  fi
fi

exit 0
