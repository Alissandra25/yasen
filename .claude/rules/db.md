---
paths:
  - "src/db/**"
  - "drizzle/**"
  - "drizzle.config.ts"
---

# Database rules

- Table and column names: snake_case. TypeScript names: camelCase via Drizzle's casing option.
- Every table spreads the shared `timestamps` helper (`created_at` default now(), `updated_at` with `$onUpdate`). Direct SQL that changes rows must set `updated_at` itself.
- Every business-owned table has `business_id` with a foreign key to `businesses`.
- Money columns: `integer` (kopecks). Never `real`, `doublePrecision` or `numeric`.
- Date-only columns: `date(..., { mode: 'string' })`. Moments: `timestamp(..., { withTimezone: true })`.
- Foreign keys are NOT NULL unless the spec marks the field nullable. Add an index on every foreign key used in filters.
- `sales.client_uuid`: unique, nullable. Inserts use `onConflictDoNothing` on it.
- The data model in `docs/spec/technical.md` (section 11) is the target. Add tables with the stage that needs them, not all at once.
- Never edit an applied migration. Never run `drizzle-kit push` against a shared database.
- Quantities are integer thousandths of the product's unit (`2.5 m` → `2500`, `3 pcs` → `3000`). Parse, compute, round and format them only through `src/lib/quantity.ts` (like money). Whole units (pcs, pack) must be multiples of 1000. Never use floats for quantities.
- `products.unit` is locked once the product has a posted movement; changing it later goes through the "convert to another unit" flow (new product + two `unit_change` adjustments + archive), never by editing the column.
- Every posted document (purchase, transfer, stocktake post, return) carries a client-generated `client_uuid` (unique). A repeated post with the same id returns the existing document instead of creating a new one.
