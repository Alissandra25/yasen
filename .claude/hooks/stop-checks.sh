#!/usr/bin/env bash
# Stop: before Claude finishes, run typecheck and unit tests if code changed.
# On failure, exit 2 sends the output back so Claude keeps working.
# Gives up after 3 forced continuations in a row to avoid an endless loop.
source "$(dirname "$0")/lib.sh"
cd "$PROJECT_DIR" || exit 0

counter=".claude/.stop-attempts"
active="$(json_field stop_hook_active)"
attempts=0
[ -f "$counter" ] && attempts="$(cat "$counter")"
[ "$active" != "true" ] && attempts=0

[ -d node_modules ] || exit 0

# Skip when nothing in the code changed (chat-only turns).
if git rev-parse HEAD >/dev/null 2>&1 \
   && git diff --quiet HEAD -- src scripts tests 2>/dev/null \
   && [ -z "$(git ls-files --others --exclude-standard src scripts tests 2>/dev/null)" ]; then
  rm -f "$counter"
  exit 0
fi

fail() {
  attempts=$((attempts + 1))
  if [ "$attempts" -gt 3 ]; then
    rm -f "$counter"
    echo "Checks still failing after 3 attempts — stopping. Tell the user what is broken." >&2
    exit 0
  fi
  echo "$attempts" > "$counter"
  echo "$1" >&2
  printf '%s\n' "$2" | tail -60 >&2
  exit 2
}

out="$(npm run -s typecheck 2>&1)" || fail "Typecheck failed. Fix it before finishing:" "$out"
out="$(npm run -s test 2>&1)" || fail "Unit tests failed. Fix them before finishing:" "$out"

rm -f "$counter"
exit 0
