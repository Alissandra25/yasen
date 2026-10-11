---
name: db-migration
description: Generate, review and apply a Drizzle database migration after a schema change. Use after any edit in src/db/schema/.
---

# Database migration

1. Make sure the schema change follows `.claude/rules/db.md` (timestamps helper, business_id, integer money, string dates).

2. Generate: `npm run db:generate`. Never write or edit migration SQL by hand, and never touch a migration that is already committed.

3. **Review the generated SQL** in `drizzle/` before applying. Stop and ask the user if it contains any of:
   - `DROP TABLE`, `DROP COLUMN`, `ALTER COLUMN ... TYPE`, or a rename that Drizzle expressed as drop + add;
   - a new `NOT NULL` column without a default on a table that may already have rows;
   - changes to `sales`, `inventory`, `price_history` or `audit_log` (live business data).
   For these, propose a safe sequence (add nullable → backfill → set NOT NULL; copy data before dropping).

4. Apply locally: `npm run db:migrate`. Run `npm run test` to make sure services still pass.

5. Commit the schema change and the generated migration together, with a message describing the data change.

Never run `drizzle-kit push`, and never point a migration command at the production database from here. Production migrations run in the deploy pipeline.
