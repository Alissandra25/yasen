#!/usr/bin/env bash
# SessionStart (compact): after the context is compacted, re-add the current stage and the rules
# that are most often lost. Stdout of this hook is added to Claude's context.
cd "${CLAUDE_PROJECT_DIR:-$(pwd)}" || exit 0

echo "Context restored after compaction."
echo
if [ -f docs/CURRENT_STAGE.md ]; then
  sed '/^## Later stages/,$d' docs/CURRENT_STAGE.md
  echo
fi
cat <<'EOF'
Rules that must survive compaction:
- Money: integer kopecks via src/lib/money.ts only; never parseFloat; round once, half away from zero.
- Dates: business time zone; date-only values stay 'YYYY-MM-DD' strings, never a JS Date.
- Every state change: permission check → Zod → service in a transaction → audit log.
- Sales: never blocked by stock; matrix is append-only with client_uuid.
- No literal UI text: next-intl keys in en/uk/ru.
- Build only the current stage; ask before anything from a later one.
EOF
