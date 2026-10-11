# Yasen — inventory & sales app

Web app for a small retail shop ("Ясен", household goods): products and stock across locations,
daily sales entered by the owner in a day matrix, restock lists, stocktakes, analytics.
One installation per business for now, but every business-owned table carries `business_id`.

## Where things are

- **Spec (source of truth):** `docs/spec/technical.md` (how) and `docs/spec/business.md` (what, plain language).
  Read the relevant section before building a feature. Do not import the whole spec into context.
- **Current stage:** `docs/CURRENT_STAGE.md`. Build only what the current stage lists.
  If a task needs something from a later stage, stop and ask.
- Target layout:
  - `src/app/` — routes (App Router), `src/components/` — UI, `src/components/ui/` — shadcn (generated, don't hand-edit)
  - `src/db/schema/` — Drizzle schema, `drizzle/` — generated migrations
  - `src/server/services/` — business logic (pure, unit-tested), `src/server/actions/` — server actions (auth + validation + call service)
  - `src/lib/money.ts`, `src/lib/dates.ts`, `src/server/audit.ts` — cross-cutting helpers
  - `messages/{en,uk,ru}.json` — translations (next-intl)

## Stack

Next.js (App Router) · TypeScript strict · PostgreSQL (Neon in dev) · Drizzle ORM + Drizzle Kit · Zod ·
Tailwind + shadcn/ui · TanStack Query · next-intl · next-themes · culori · Recharts · React-pdf ·
Resend · Sentry (@sentry/nextjs) · Vitest + Playwright.
Do not add a dependency that is not in this list without asking first.

## Commands

- `npm run dev` · `npm run build`
- `npm run lint` · `npm run typecheck` · `npm run format`
- `npm run test` (Vitest) · `npm run test:e2e` (Playwright)
- `npm run db:generate` (new migration from schema) · `npm run db:migrate` (apply)
- `node scripts/i18n-check.mjs` (missing translation keys)

## Cross-cutting rules (always)

**Money**

- Store and compute money as integer minor units (kopecks). Never a float, never `numeric` → JS number.
- All conversion, rounding and formatting goes through `src/lib/money.ts`. Round once, at the end, half away from zero.
- Parse user input as text: normalise (spaces out, comma → dot), validate with Zod (max 2 decimals), then `Math.round(Number(s) * 100)`. Never `parseFloat`.
- VAT per document line; totals are sums of rounded lines.

**Dates and time**

- "Day" and "month" are always in the business time zone (`businesses.timezone`, default Europe/Kyiv), never the server's or the browser's.
- Exact moments: `timestamptz` in UTC, displayed in the business time zone for every user.
- Date-only values (e.g. `sales.sale_date`): Postgres `date`, Drizzle `mode: 'string'`, kept as `'YYYY-MM-DD'` strings. Never turn them into a JS `Date`.
- Helpers live in `src/lib/dates.ts`; use them instead of ad-hoc date math.

**Data integrity**

- Every table has `created_at` and `updated_at` via the shared schema helper.
- Every state-changing action writes to the audit log via `src/server/audit.ts` (who, when, action type, old → new, reason). Corrections store the whole document before and after.
- A sale is never blocked by missing stock; stock may go negative.
- Matrix sales are append-only and carry a client-generated `client_uuid`; the server accepts each uuid once.
- Closed periods (last stocktake / auto month close) are read-only. Fix mistakes there with a stock adjustment dated today.

**Server**

- Every server action: check the role/permission, validate input with Zod, call a service, write the audit log. In that order.
- Business logic lives in services, not in components or route handlers.

**UI**

- No user-facing text in components: use next-intl keys and add them to all three locales (en, uk, ru).
- Colours only through theme tokens. Brand colours are per business; semantic colours (error / warning / success) are fixed and never use the brand.

## Local dev server

- Never kill a running `next dev` (or other dev server) process you didn't start, or one the user
  may be watching in their own terminal/IDE. If you need a port for debugging, run yours on a
  different port and leave the existing one alone.
- If a change requires a restart to take effect (e.g. editing `next.config.ts`, `.env*`, or
  anything else Next.js doesn't hot-reload), don't restart the user's process yourself — tell them
  plainly what changed and that their running server needs a restart to pick it up.

## Workflow

- Unit tests are mandatory for business logic (money, stock, restock rules, offline merge, corrections). Write them with the code, not after.
- Run `npm run typecheck` and `npm run test` before saying a task is done (a Stop hook also enforces this).
- Migrations: generate with Drizzle Kit, never hand-edit or edit an already-applied migration. Use the `db-migration` skill.
- New feature end to end: use the `add-feature` skill.
- If you make or discover a decision the spec doesn't cover, say so and use the `spec-update` skill — don't silently invent rules.
