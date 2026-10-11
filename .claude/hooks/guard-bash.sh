#!/usr/bin/env bash
# PreToolUse (Bash): block destructive or production-touching commands.
source "$(dirname "$0")/lib.sh"

cmd="$(json_field tool_input.command)"
[ -z "$cmd" ] && exit 0

block() {
  echo "Blocked: $1" >&2
  echo "Command: $cmd" >&2
  exit 2
}

if printf '%s' "$cmd" | grep -Eiq 'drizzle-kit[[:space:]]+push'; then
  block "drizzle-kit push bypasses migrations. Use npm run db:generate + npm run db:migrate (db-migration skill)."
fi

if printf '%s' "$cmd" | grep -Eiq '(^|[^a-z_])drop[[:space:]]+(table|database|schema)'; then
  block "DROP statements must go through a reviewed migration, never an ad-hoc command."
fi

if printf '%s' "$cmd" | grep -Eiq '(^|[^a-z_])truncate[[:space:]]'; then
  block "TRUNCATE wipes data. Ask the user first."
fi

if printf '%s' "$cmd" | grep -Eq 'PROD(UCTION)?_DATABASE_URL|RAILWAY_DATABASE_URL'; then
  block "Commands must not touch the production database from a dev session."
fi

if printf '%s' "$cmd" | grep -Eq 'git[[:space:]]+push([[:space:]].*)?[[:space:]](-f|--force|--force-with-lease)([[:space:]=]|$)'; then
  block "Force push is not allowed. Ask the user."
fi

if printf '%s' "$cmd" | grep -Eq 'rm[[:space:]]+-[a-zA-Z]*r[a-zA-Z]*f?[[:space:]]+(/|~|\$HOME)([[:space:]]|$)'; then
  block "Refusing to delete a root or home directory."
fi

exit 0
