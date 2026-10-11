---
name: add-feature
description: Build a feature end to end (schema, migration, validation, server action, audit log, UI, translations, tests). Use whenever adding a new entity, document type or user-facing flow.
---

# Add a feature end to end

Work through these steps in order. Don't skip a step because the feature looks small.

1. **Check scope.** Confirm the feature is in `docs/CURRENT_STAGE.md`. Read its section in `docs/spec/technical.md` (and `docs/spec/business.md` for wording). If the spec is silent or ambiguous on a rule, ask before inventing one.

2. **Schema.** Add or change tables in `src/db/schema/` following `.claude/rules/db.md`. Then run the `db-migration` skill.

3. **Validation.** Write the Zod schemas in the same feature folder. Money inputs use the shared money schema (text → kopecks); date-only inputs use the shared `YYYY-MM-DD` schema.

4. **Service.** Put the business logic in `src/server/services/<feature>.ts` as plain functions that take a db/transaction handle. No auth, no request objects here, so it stays testable.
   - Stock changes, money and anything date-based go through `money.ts` / `dates.ts`.
   - Multi-step writes run in one transaction.
   - If the action touches a closed period, reject it (see spec 4.5).

5. **Server action.** In `src/server/actions/<feature>.ts`: check the permission → parse with Zod → call the service inside a transaction → write the audit log (`src/server/audit.ts`) in the same transaction → return a typed result.

6. **Tests.** Unit tests for the service in `<feature>.test.ts`: the happy path, every business rule in the spec section, and edge cases (negative stock, zero, rounding, business time zone at day boundaries). Integration test for the server action if it's one of the key scenarios in spec 10.

7. **UI.** Pages and components per `.claude/rules/ui.md`. Data via TanStack Query; mutations invalidate the affected queries.

8. **Translations.** Add every new key to `messages/en.json`, `uk.json` and `ru.json`, then run `node scripts/i18n-check.mjs`.

9. **Verify.** `npm run lint`, `npm run typecheck`, `npm run test`. Fix everything before reporting done.

10. **Report.** Summarise what was built, any decision you had to make, and anything left for later. If a decision isn't in the spec, run the `spec-update` skill.
