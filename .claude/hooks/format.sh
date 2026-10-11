#!/usr/bin/env bash
# PostToolUse (Edit|Write|MultiEdit): format the edited file and lint it.
# Remaining lint errors are reported back to Claude (exit 2) so it fixes them right away.
source "$(dirname "$0")/lib.sh"

file="$(json_field tool_input.file_path)"
[ -z "$file" ] || [ ! -f "$file" ] && exit 0
[ -d "$PROJECT_DIR/node_modules" ] || exit 0
cd "$PROJECT_DIR" || exit 0

case "$file" in
  *.ts|*.tsx|*.js|*.jsx|*.mjs|*.cjs|*.json|*.css|*.md)
    npx --no-install prettier --write --log-level warn "$file" >/dev/null 2>&1 || true
    ;;
  *) exit 0 ;;
esac

case "$file" in
  *.ts|*.tsx|*.js|*.jsx|*.mjs|*.cjs)
    if ! out="$(npx --no-install eslint --fix "$file" 2>&1)"; then
      echo "ESLint errors remain in $(rel_path "$file") — fix them:" >&2
      printf '%s\n' "$out" | tail -40 >&2
      exit 2
    fi
    ;;
esac

exit 0
