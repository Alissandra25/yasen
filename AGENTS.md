<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Yasen — inventory & sales app

Web app for a small retail shop ("Ясен", household goods): products and stock across locations,
daily sales entered by the owner in a day matrix, restock lists, stocktakes, analytics.
One installation per business for now, but every business-owned table carries `business_id`.

Shared rules for any AI coding agent working in this repo. Claude Code additionally reads
`CLAUDE.md`, which layers its own tool-specific mechanics (skills, hooks) on top of this file —
see "Behavior Claude Code enforces mechanically" at the end of this file for what those mechanics
actually do, described tool-agnostically for any other agent reading this.

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
- **Imports:** always `@/*` (maps to `./src/*`), never a relative path that climbs out of the
  current directory (`../src/...`, `../../lib/...`). Applies everywhere, including `scripts/`.

## Stack

Next.js (App Router) · TypeScript strict · PostgreSQL (Neon in dev) · Drizzle ORM + Drizzle Kit · Zod ·
Tailwind + shadcn/ui · TanStack Query · next-intl · next-themes · culori · Recharts · React-pdf ·
Resend · Sentry (@sentry/nextjs) · Vitest + Playwright · bcryptjs (password hashing) · dnd-kit
(drag & drop reorder for categories) · csv-parse (CSV import) · @tanstack/react-virtual (row
virtualization for long tables: Sales, Stock, Products).
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
- If an element can take visible time to appear (data still loading, a route transition, a virtualized
  list's rows not yet in the DOM), show a skeleton instead of empty space — a block skeleton for a
  single area, list-item skeletons shaped like the real rows for a list/table. Never leave a blank
  gap where content is about to load.

## Local dev server

- Never kill a running `next dev` (or other dev server) process you didn't start, or one the user
  may be watching in their own terminal/IDE. If you need a port for debugging, run yours on a
  different port and leave the existing one alone.
- If a change requires a restart to take effect (e.g. editing `next.config.ts`, `.env*`, or
  anything else Next.js doesn't hot-reload), don't restart the user's process yourself — tell them
  plainly what changed and that their running server needs a restart to pick it up.

## Workflow

- Unit tests are mandatory for business logic (money, stock, restock rules, offline merge, corrections). Write them with the code, not after.
- Verify with `npm run typecheck` and `npm run test` before saying a task is done.
- Migrations: generate with Drizzle Kit, never hand-edit or edit an already-applied migration.
- If you make or discover a decision the spec doesn't cover, say so — don't silently invent rules.
- Before adopting a new pattern or API you haven't used in this project yet (a library integration, a
  framework convention, anything that feels like "the modern way to do X"), verify it's real and still
  current — check the installed package's own docs/source (e.g. `node_modules/next/dist/docs/`, per
  this file's own note above) or its official site, not just training-data memory. Don't guess and let
  the user catch a deprecated or nonexistent API after the fact.

## Behavior Claude Code enforces mechanically

Claude Code backs some of the rules above with its own skills and hooks — described here
tool-agnostically, for whichever agent is reading this file. If your tool has an equivalent
(custom rules, guardrails, pre-action hooks, slash commands, whatever your system calls it),
**set it up and suggest to your user that they configure the same restrictions in your tool**,
rather than relying on remembering these rules unassisted.

**A hard gate before finishing, not just an intention**

- Run the project's typecheck and test commands (see Commands above) before considering a coding
  task done; don't rely on memory to check later.
- After editing a file, run the project's formatter/linter and fix whatever it flags before moving on.

**Guardrails on destructive or sensitive actions**

- Never edit `.env*` files or an already-applied/committed database migration directly — ask the
  user to make that change themselves.
- Never run a command that drops or truncates a database table/schema, bypasses reviewed
  migrations (e.g. `drizzle-kit push`), force-pushes git, or targets a production database URL
  from a dev session — ask the user first.

**The feature workflow, as a fixed sequence**

- Build a new feature in this order: schema change → migration (generate it, review the SQL for
  anything destructive, apply it) → Zod validation → business logic in a service function → a
  server action that checks permission, validates, calls the service inside one transaction, and
  writes the audit log → tests → UI → translations in all three locales → verify
  (lint/typecheck/test) → report what was built and any decision made along the way.

**Spec gaps get written down, not silently decided**

- If you make or discover a decision the spec doesn't cover, record it directly in the relevant
  spec file (`docs/spec/technical.md` / `business.md`) — the decision and the reason — instead of
  just proceeding.

**Translation keys stay in sync across locales**

- After adding or changing a translation key, confirm all three locale files (`en`, `uk`, `ru`)
  have matching keys before considering the work done.
