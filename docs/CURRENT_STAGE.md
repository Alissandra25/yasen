# Current stage: 0 — Foundation

Build only what is listed here. Anything from a later stage: stop and ask.

## Stage 0 — Foundation
- Next.js project, Drizzle + Neon, deploy to Vercel from GitHub.
- Owner login, password change, password reset by email (Resend).
- Cross-cutting helpers from day one: `money.ts`, `dates.ts` (business time zone), timestamps schema helper, audit log, next-intl with en/uk/ru, light/dark theme (next-themes).
- Sentry, Vitest set up with first unit tests, nightly encrypted `pg_dump` via GitHub Actions.

## Later stages (do not build yet)
1. **MVP:** locations, categories (with order), products, archive, CSV import, suppliers (always on), goods receipts (location per line, split line), sales matrix (cash/card split, `client_uuid`, append-only), daily cash summary + discount adjustment, stock view with negatives highlighted, manual adjustments, transfers.
2. **Offline** sales matrix (Service Worker + IndexedDB queue + sync).
3. **Control:** stocktakes + PDF act, customer returns + supplier replacements, restock lists, corrections of posted documents + period closing, export (PDF/Excel), monthly report.
4. **Analytics & settings:** dashboard, profitability, discrepancy analytics, brand colours + logo upload, archive/needs-review filters, optional supplier tracking.
5. **Maturity:** Docker, GitHub Actions CI/CD, move to Railway, Railway backups + restore drill.
