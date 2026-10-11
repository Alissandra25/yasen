# Current stage: 1 — MVP

Build only what is listed here. Anything from a later stage: stop and ask.

## Stage 1 — MVP

- Locations, categories (with order), products, archive, CSV import.
- Suppliers (always on), goods receipts (location per line, split line).
- Sales matrix (cash/card split, `client_uuid`, append-only), daily cash summary + discount adjustment.
- Stock view with negatives highlighted, manual adjustments, transfers.

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
4. **Analytics & settings:** dashboard, profitability, discrepancy analytics, brand colours + logo upload, archive/needs-review filters, optional supplier tracking.
5. **Maturity:** Docker, GitHub Actions CI/CD, move to Railway, Railway backups + restore drill.
