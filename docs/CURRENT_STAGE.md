# Current stage: 1 — MVP (feature-complete; see note below)

Build only what is listed here. Anything from a later stage: stop and ask.

## Stage 1 — MVP (done)

- Locations, categories (with order), products, archive, CSV import. Done.
- Suppliers (always on), goods receipts (location per line, split line). Done.
- Sales matrix (cash/card split, `client_uuid`, append-only), daily cash summary + discount adjustment. Done.
- Stock view with negatives highlighted, manual adjustments, transfers. Done.

All eleven Stage 1 milestones (owner login through transfers) are built, tested (unit tests +
a real-DB integration smoke test per milestone) and committed. Not yet done, deliberately left
for a human: a final end-to-end walkthrough in the browser as the owner, and moving to Stage 2
once that's confirmed. Two small pre-existing Stage 0 items are still open, blocked on
credentials (see below) — they don't block using the MVP.

## Stage 0 — Foundation (done, except where noted)

- Next.js project, Drizzle + Neon, deploy to Vercel from GitHub. Done.
- Cross-cutting helpers from day one: `money.ts`, `dates.ts` (business time zone), timestamps schema helper, audit log, next-intl with en/uk/ru, light/dark theme (next-themes). Done.
- **Still open, blocked on credentials — pick up when available:**
  - Owner login, password change, password reset by email (Resend).
  - Sentry.
  - Nightly encrypted `pg_dump` via GitHub Actions.
- Vitest set up with first unit tests. Done.

## Later stages (do not build yet)

2. **Offline** sales matrix (Service Worker + IndexedDB queue + sync).
3. **Control:** stocktakes + PDF act, customer returns + supplier replacements, restock lists, corrections of posted documents + period closing, export (PDF/Excel), monthly report.
4. **Analytics & settings:** dashboard, profitability, discrepancy analytics, brand colours + logo upload, archive/needs-review filters, optional supplier tracking, configurable payment methods (reorder/add/rename — cash and card are hardcoded until then; confirmed with the owner during the redesign QA pass).
5. **Maturity:** Docker, GitHub Actions CI/CD, move to Railway, Railway backups + restore drill.
