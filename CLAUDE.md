@AGENTS.md

# Claude Code specifics

Everything else needed to work in this repo is in `AGENTS.md` (imported above) — project
description, stack, file layout, cross-cutting business rules, commands, workflow. This file
only adds what's specific to Claude Code.

## Skills

- **New feature end to end** (schema → migration → Zod → service → server action with permission
  check + audit log → tests → UI → translations → verify): use the `add-feature` skill.
- **Schema changes:** use the `db-migration` skill (generate with Drizzle Kit, review the SQL,
  apply, test).
- **Spec gaps:** when you make or discover a decision the spec doesn't cover, use the
  `spec-update` skill to record it, rather than just proceeding silently.
- **Translation keys:** use the `i18n-sync` skill after adding or changing keys in
  `messages/*.json`.

## Hooks

- A Stop hook runs `npm run typecheck` and `npm run test` before a turn can finish — `AGENTS.md`'s
  Workflow instruction to verify both is enforced automatically, not just a reminder.
- Other hooks block editing `.env*` or a committed migration, and block destructive or
  production-touching Bash commands (`DROP`/`TRUNCATE`, `drizzle-kit push`, force-push, a
  production DB URL).
- Prettier + ESLint run after every edit; remaining lint errors are sent back to fix.
