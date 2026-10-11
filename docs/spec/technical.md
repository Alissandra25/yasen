# Technical Specification — Yasen inventory & sales app

> Source of truth for development. Plain-language requirements for the shop owner: [business.md](business.md).
> Exported from the English Notion spec; keep both in sync (see the `spec-update` skill).

> 🗂 Structure of this file: first **Part A — Business Logic** (what the system does), then **Part B — Technical Implementation** (how it is built).

# PART A — Business Logic

## 1. Product Overview

A web application for a small business (retail shop) to track products, record sales and run analytics. The goal is to give the owner a single tool to see stock levels and daily sales, generate restock lists and analyse profitability.

## 2. Users and Roles

- **Owner** — full access: products, warehouse, sales, analytics, user management. Only this role is active at launch.
- **Seller** — limited access: records sales, sees stock levels. Cannot see analytics or profitability.

The role model is built into the architecture from day one (RBAC), even though only the owner is used initially.

## 3. Core Functionality

### 3.1 Product Catalogue

- Product catalogue: name, SKU, category, purchase price, sale price.
- **One unit of measure per product (end to end):** every product is measured in one fixed unit from receipt to sale. Pack or piece — the system does not care: if a product is counted in packs, then a "piece" for that product is a pack. What matters is that quantity is always in the same unit, so stock is always correct. Complexity would only arise if the same product arrived by the box but was sold by the piece (requiring conversion) — this shop has no such case (to be confirmed with the owner).
- Stock levels in the shop and in the warehouse (separate values).
- Editing and archiving products.
- **Categories and subcategories — a separate reference table with display order:** categories and subcategories are stored in a separate categories table (a subcategory = a category with a parent), not as text fields on the product. Each has a sort_order. The order is configured in settings via drag & drop: categories among themselves, subcategories within their category. On drag, sort_order is recalculated within the same parent.
- **Hint filters in reference lists:** a reference list shows the normal list plus a few ready-made filters at the top (needs review; archive candidates, etc.).
- **"Needs review" filter (quickly created records):** when a product or supplier is created on the fly (a supplier with just a name, a product straight from a receipt), the system sets a needs_review flag.
  - **The criterion is not "empty fields" but the fact of quick creation without review.** This avoids the problem that products are formally fully filled (default rules, stock) yet still worth reviewing. Optional fields (e.g. supplier contacts) do not make a record incomplete.
  - **Clearing the flag:** the owner opens the record, reviews it and confirms — the flag is cleared even if something is still empty.
  - **Bulk confirmation:** select several records and clear the flag on all of them in one action, without opening each (the same "select many, one action" pattern as archiving and CSV conflicts).
- **Archive candidates** — a separate filter:
  - **Products:** zero stock that has not moved for a set period (default 1 month).
  - **Suppliers:** no receipts for a set period (default 3 months). A different criterion from products, because suppliers have no stock.
  - Both periods are in the business settings and can be adjusted by the owner.
  - In the filter you can select all or some and archive them in bulk.

### 3.2 CSV Import of Reference Data

Bulk upload of products and suppliers from a CSV file (e.g. initial database population).

- The system parses rows and creates everything new automatically.
- **Duplicate detection by name:** comparison ignoring case and extra whitespace ("Bosch Washing Machine" = "bosch washing machine ").
- **Conflict dialog:** all matches are shown in a separate list; for each, the user chooses: **merge** (fill empty fields from the file), **overwrite** (take values from the file) or **keep existing** record.
- **Bulk action** "do this for all" at the top, so matches don't have to be resolved one by one when there are many.
- New records are created immediately; the dialog is only for matches — no record is overwritten without the user's decision.

### 3.3 Goods Receipt (Purchasing)

- The owner records a receipt from a supplier as **a single document** (like a transfer): chooses the supplier and a default destination location (usually a warehouse).
- **Destination per line:** each line has its own location (warehouse or shop), prefilled with the receipt's default. Bulk action: select several or all lines and assign one location to them.
- **Split line:** a 'split line' button adds a copy of the same product below; the user enters how many units go to the new part and picks its location, and the original line's quantity decreases accordingly. Split lines of one product share the purchase and sale price — changing it in one changes all parts, so price_history gets exactly one price per product per receipt.
- Posting increases stock of each product at the location of its line. A later correction that changes a line's location moves the difference between locations (see 4.5). The printed receipt shows the location on every line.
- For each line: product, quantity, **purchase price** (required) and **retail (sale) price** (optional).
- The sale price can be left empty at receipt and set later. A sale-price entry is added to price_history when it is set.
- Posting the receipt increases stock and, if the price changed, automatically adds a record to price history (price_history) — both prices together, with the same date.
- A new product not yet in the catalogue can be created directly from the receipt.
- **Starting minimum stock from a receipt:** when a product is created from a receipt (min_stock not specified), its starting value = 10% of the received quantity, rounded up, but **never less than 1** (two washing machines → minimum 1, not 0). This is a default hint; the owner can change it manually.
- **Supplier on the fly:** if the supplier is not yet in the reference list, its name can be typed directly into the receipt field — it is automatically created in the list (new unique id). Only the name is required; contacts and notes can be added later without going to a separate table.
- The receipt is recorded in the audit log and linked to the supplier.

### 3.4 Sales

- Recording a sale: product, quantity, date, who sold it, **payment method**.
- Automatic deduction from stock.
- Viewing sales for a day / period.
- **Payment method** is recorded on each sale (cash / card at launch, with an extensible list — e.g. bank transfer, mixed payment). Enables cash reconciliation (how much cash / card per day) and revenue breakdown in analytics.

### 3.5 Owner Sales Entry Mode (Day Matrix)

At launch, sales are entered **by the owner after the fact** — e.g. in the evening they transfer into the app what sellers wrote down by hand. This is **batch entry**, not a real-time POS (the latter is for the future, see "Future").

- **Format — a matrix table:** rows are products, columns are days of the period; each cell holds the quantity of that product sold on that day.
- **Category filter** (later also subcategory) to quickly narrow the product list.
- **Order without a filter:** when all categories are shown, matrix rows are grouped by category (then subcategory) according to the sort_order set by the owner.
- **Product order within a category:** standard sorts chosen by the user (ORDER BY): by name (A–Z / Z–A), by creation date (newest / oldest first), by SKU, etc. Manual drag-and-drop ordering of products — in the future, if needed.
- The owner **edits / adds the quantity** sold directly in the cell for a specific day (the sale date is the column's day, not the current date).
- Stock is shown alongside: how much there was at the start of the period and how much is left now.
- Each filled cell creates / updates records in sales with the corresponding date.
- **Price for backdated entries:** a sale entered for a past day takes the sale price and purchase cost (unit_price, unit_cost) that were in effect on that day according to price_history — not today's prices. Otherwise a price change mid-week would silently distort profitability for earlier days.
- **Payment method — optional per-cell split, with a toggle above the matrix.** The cash/card split toggle sits **directly above the table** (not in general settings) so the owner can switch any time: in a hurry today — enter everything as cash in one cell; have time tomorrow — turn on the split and enter separately.
  - **On:** each cell is two fields (e.g. 50 pcs cash + 5 pcs card). Exact breakdown per item.
  - **Off (default):** one cell for quantity; the owner enters however is convenient (may attribute everything to cash).
- Model consequence: with the split on, sales store quantity separately per payment method (payment_method per record); with it off, payment_method may be empty or a single default.

### 3.6 Offline Mode (Sales Matrix Only)

The sales entry matrix must work without internet — the owner often enters data in the evening on an unstable connection.

- **Offline only for entering sales in the matrix.** Editing reference data (products, prices, suppliers) is online only. This deliberate restriction removes almost all the complexity.
- **No conflicts — append only.** Offline entry overwrites nothing, it only adds new records to sales. If both the owner (offline) and a seller (online) enter sales, these are two sets of new records that simply merge; neither overwrites the other.
- **Duplicate protection:** each offline record gets a unique identifier on the device (client_uuid). If sync is repeated (bad connection, sent twice), the server recognises an already-accepted record by this id and does not duplicate the sale.
- **Mechanism:** Service Worker + local storage (IndexedDB). Offline entries are queued; when the network returns, the queue is sent to the server and stock is recalculated from the full sales total.
- **Whole catalogue on the client:** for offline use, the product list is fully synced to the client (you can't know in advance which category will be opened). This is lightweight data (name, SKU, price, stock) — even several thousand items are a few hundred kilobytes; synced once, then changes are pulled incrementally. The category filter remains a convenience on already-loaded data, not a way to load in chunks.

### 3.7 Restock Lists

The list is built not by one rigid rule but by a set of rules that can be enabled and extended.

- **Base rule (minimum stock):** a product enters the list when stock falls below min_stock (a product field).
- **Sales activity rule (drawdown since start of month):** a product enters the list when it has drawn down by 50% or more relative to a reference point.
  - **Why from the start of the month:** the system keeps no daily stock snapshots and does not reconstruct them from the log (deliberate simplification). The solid reference point is stock at the start of the month (already shown in the matrix).
  - **Calculation:** reference = stock at start of month + receipts since start of month; drawdown = sales since start of month. Triggers when sales ≥ 50% of the reference. Everything is computed from data already on the matrix screen.
  - **Consequence:** this is accumulation from the 1st, not a rolling window; it is more likely to trigger towards month end. It is a signal "the product is moving, time to think about ordering", not an exact mathematical threshold.
- **Auto-enabled on product creation:** a new product automatically gets both rules — minimum stock and sales activity (50% of reference).
- **One rule per business + per-product overrides:** defaults (50% threshold, minimum) live at business level; products have optional override fields (if set, they override the business default; if empty, the business default applies). Avoids thousands of identical records.
- **Period for other velocity rules** remains a parameter (day / week / month) for future rule types.
- The rule set is extensible — new rule types can be added without rewriting the schema (see the restock_rules entity in the data model).
- **Suggestions are computed on the fly, not stored.** When the owner opens the restock page, the suggestion is calculated by a query from current stock, sales and receipts since the start of the month, and the rule thresholds. No scheduled job is needed; even for thousands of products this is one aggregate SQL query.
- **Need is calculated per business, not per location:** stock across all locations is summed. Purchasing normally goes to the warehouse; topping up a specific shop is handled by a transfer, not a supplier order.
- **Saved lists are documents.** The owner edits the suggestion (changes quantities, adds products manually, removes rows) and saves it. Several lists can exist at once. A saved list can be printed or exported (PDF / Excel) through the common export mechanism.
- **Statuses:** draft → ordered → done. Done is set manually, or automatically when all items have arrived via receipts. Lists without activity are archived after a while, not deleted — the history of what was ordered and when is useful.
- **Snapshot vs live data:** quantity and supplier in a saved list are fixed when saved; current stock is shown next to each row live, so changes since then are visible.
- **Avoiding double orders:** when a new suggestion is generated, products already present in an open (draft / ordered) list are not excluded but marked 'already in list from \<date\>' — sometimes topping up is intentional.
- **Counter in the menu:** the same query returns just the count ('7 products need restocking') next to the menu item, so the owner sees it without opening the page.
- **Grouping by supplier:** a list is grouped by each row's supplier, plus a 'no supplier' group; each group can be exported separately as an order to that supplier. The row's supplier defaults to the product's main supplier (default_supplier_id) and can be changed for that row. Not available when supplier tracking is off (see 3.11).

### 3.8 Analytics (Dashboard)

- Charts of top sales (top items for a period).
- Profitability: margin = sale price − purchase price.
- Revenue and profit per day / week / month.
- **Cash reconciliation (simple version):** totals for a selected day / period — how much revenue was cash, how much card, and the overall total. This is just a sum of entered data, without a physical cash count.
- **Daily discount adjustment (simple compromise at launch):** the matrix has no concept of a "receipt", so discounts (e.g. for military personnel) are not a separate mechanism but a single adjustment field per day: the owner enters how much lower actual revenue was than calculated due to discounts, with a note. Reconciliation balances; profitability is approximate. Full discount tracking — in "Future" (together with POS).
- **Future:** real reconciliation — the owner enters the actual cash in the till at day end, the system compares it with the expected amount and shows shortage/surplus (requires daily manual input, so not at launch).

### 3.9 Export of Documents and Reports

Two different scenarios with different formats.

- **Printable forms — PDF** (appearance matters, signed / filed): stocktake report, transfer document, goods receipt document.
- **Analytical exports — Excel / CSV** (so the owner can work with the data further): sales for a period, revenue / profit, discrepancy analytics, stock levels.
- Export uses a single mechanism (shared generation layer) so new report types can be added without duplicating code.
- **Format is independent of report type:** any report — summary or smaller individual — can be exported to either PDF or Excel.
- Low priority for the current shop, but built into the architecture from the start since the mechanism is the same for all reports.

### 3.10 Monthly Movement Report (Summary + Individual)

A summary of all goods and money movement for a period in one place.

- **Monthly summary report** with sections: receipts (what arrived), sales, returns broken down by type (resellable / defective for replacement / defective write-off, and how resolved: same product / substitute / money), stocktakes and adjustments, totals.
- **Smaller individual reports** for each section separately (sales only, returns only, etc.). Same data — the summary combines everything, the individual ones show a part.
- **Built on top of the audit log** — all movement already goes there, no new entities needed in the model.
- Any of these reports can be exported to PDF (for viewing) or Excel (for analysis).

### 3.11 Optional Supplier Tracking

A business may not want to track suppliers at all. A business setting (suppliers_enabled, on by default) turns supplier tracking off.

- **When off, the UI hides:** the supplier field on goods receipts; the supplier reference list and its CSV import; supplier filters and columns in tables and reports; archive candidates and needs-review for suppliers; the main supplier on the product card; grouping of restock lists by supplier (a list becomes a single whole).
- **Under the hood:** new receipts created while tracking is off are linked to a hidden system supplier ([suppliers.is](http://suppliers.is)_system = true), which cannot be edited or deleted and is not shown in the reference list. Foreign keys stay NOT NULL; joins work unchanged.
- **Existing data is never rewritten.** If tracking is turned off when suppliers and receipts already exist, their links stay as they are and are only hidden. Turning tracking back on restores everything; receipts created while it was off appear under 'No supplier' and can be reassigned.
- **Defective returns for supplier replacement (type 2a)** keep working when tracking is off — just without a supplier name.
- **Main supplier of a product (when tracking is on):** default_supplier_id defaults to the supplier of the product's latest receipt and can be changed manually.

## 4. Stock Movement, Adjustments and Audit Log

### 4.1 Selling Without Stock and Adjustments

- A sale is **never blocked** due to lack of stock. If the product physically exists and the seller sells it, the system must not get in the way.
- Stock can become **negative**.
- Negative items are **highlighted** separately in the stock list as a signal to reconcile — the discrepancy is a business accounting issue, not a reason to block the sale.
- The owner sees problem items and makes a manual adjustment.

**Stock adjustments:**

- Adjusting stock is a **permission tied to a role**, not hard-wired to the owner. At launch the owner has it; later it can be granted to another role without rewriting logic.
- When adjusting, the user specifies a **reason** (e.g. breakage, shortage, mis-sort, etc.).
- Every adjustment is recorded in the **audit log**: who, when, from old value to new, with the reason — so it can be verified.

**Full stocktake (separate mode):**
Unlike a one-off adjustment of a single item, this is a bulk count of the whole warehouse in one go (typically once a month).

- The owner opens a stocktake for a location: a list of products with **system stock**, and next to each a field for the **actual counted quantity**.
- The system immediately highlights rows that don't match and shows the difference (+/−).
- On posting, all discrepancies go to the log together (each with a reason), and stock is aligned to actual.
- The result is a **stocktake report** — a table (system / actual / difference) with **PDF export**.
- Each stocktake is saved as a document with date and lines, so it can be revisited and compared month to month.

### 4.2 Transfers Between Locations

Key principle: as simple as possible for the user, because a small business has no time for cumbersome processes.

- **One document per transfer**, not a separate form per product.
- The user chooses **from and to** (source location → destination location). "Warehouse → shop" can be the default as the most common direction.
- After choosing the source, a **list of products available at that location** opens (from actual stock), with a **category filter**.
- The user ticks the needed items and enters a quantity for each.
- One "post" click — the system subtracts from the source and adds to the destination for all lines together.
- Since the list comes from actual stock, the system knows the available quantity and highlights/limits attempts to move more than exists.
- The transfer is recorded in the audit log.

### 4.3 Customer Returns

What happens to the product depends on the reason. **Return type** determines the next steps.
**Type 1 — resellable (didn't fit):** wrong size, changed mind, etc.

- The product goes back into stock (warehouse or shop) and is available for sale again.

**Type 2 — defective:** does not go back on sale. Split into two subcategories:

- **2a — for supplier replacement:** goes into a separate "for replacement" list; the supplier is expected to compensate.
- **2b — write-off as a loss:** a pure business loss, no compensation.

**Common to all types:**

- The sale is reversed: revenue and profit for the item are reduced.
- **Customer refund and cash reconciliation:** recording a return automatically reduces the day's revenue by the refund amount. Only the **refund method** matters (cash from the till / transfer to a card), which the owner specifies manually — reconciliation is reduced in that column. The original payment method is unknown (the matrix has no individual receipts) and is not taken into account. The date is the day the return is recorded, because that is when the cash leaves the till.
- The return is recorded in the audit log with its type and reason.
- Defective items (2a/2b) are tracked in a separate model, not mixed with resellable stock.

**Closing the replacement loop (type 2a — supplier replacement):**
An item in the "for replacement" list has a status: **awaiting replacement → resolved**. When the supplier responds, the owner closes the item with one of three types:

- **Same product (1:1):** a new unit of the same product is received into warehouse stock as resellable.
- **Substitute (different item):** a different product comes into the warehouse; quantity and item may differ, the record captures what it was replaced with.
- **Cash compensation:** no product returns to the warehouse; the business receives a refund (processed as a financial reimbursement, not a stock movement).
- In all three cases the item is closed, and the whole chain stays visible in the log: sale → defect → sent to supplier → how it was resolved.

### 4.4 Audit Log

- **All state-changing actions** are recorded: sale, stock adjustment, transfer, return, product or price change, user actions.
- Each entry contains: **who** (user), **when** (exact time), **action type**, **what exactly changed** (from old value to new).
- Structure — **separate fields** (action type, product, reason, numbers separately), not free text — so they can be filtered and aggregated.
- The log is the **basis for discrepancy analytics** (built on adjustment and stocktake data):
  - which items most often don't match and why (breakage / shortage / mis-sort);
  - where the biggest monetary losses are (difference × purchase price);
  - discrepancy trend month to month (is shortage growing).

### 4.5 Correcting Posted Documents and Period Closing

Posted documents (goods receipts, transfers, etc.) can be corrected after posting — within rules that keep closed periods and signed reports true.

- **A correction is applied as a difference.** If a receipt had 12 and now has 10, 2 units are removed from stock. Negative stock afterwards is allowed, as everywhere.
- **The audit log records the whole document before and after** the correction, plus who and when.
- **Correcting a purchase price** (a typo, not a real price change) updates the corresponding price_history record and recalculates unit_cost of sales that used that price — within the open period only.
- **Closed periods are read-only.** A period closes in two ways; the lock boundary is the later of the two:
  - **Stocktake:** documents dated before the last posted stocktake for that location become read-only.
  - **Automatic month close:** a month becomes read-only N days after it ends (business setting period_lock_grace_days, default 5; e.g. September locks on 5 October).
- **Mistakes in a closed period** are fixed with a regular stock adjustment with a reason, dated today — the closed period itself never changes, so a monthly report for a closed month can be safely printed and sent.
- **Reopening a period (owner only):** the owner can reopen a closed period for a serious mistake, with a mandatory reason recorded in the audit log. A reopened period closes again automatically after 24 hours, so it cannot be left open by accident.

## 5. Localisation (i18n)

- Multi-language UI support is built in from the very start (mandatory).
- Launch languages: English, Ukrainian, Russian.
- The architecture must make it easy to add more languages later.
- All UI strings live in translation files, no hard-coded text in components.
- Language is chosen by the user and the choice is persisted.

## 6. Future (Not in the First Release)

- Mobile client for tablets and phones so sellers can enter sales from the shop floor.
- POS / barcode scanner integration.
- **Full discount tracking by customer type (e.g. military).** Requires the concept of a "receipt" (individual sale), which the matrix lacks, so it naturally comes together with real-time POS mode: exact discount per receipt / item, exact profitability. At launch — the daily adjustment (see 3.8).
- **Desktop application (Windows / macOS) — future option.** Not built now, but the architecture stays compatible so it can be added later without rewriting. Next.js packages easily into a desktop wrapper (e.g. Tauri — lighter than Electron as it uses the system browser engine). Idea: "install locally if you want, or work on the web". A fully local option (embedded database on the machine) is a separate architecture with the question of syncing between devices, so not at launch.
- **Multi-currency** (e.g. purchasing in USD, selling in UAH, exchange rates by date). At launch each business has a single currency (see 7).

# PART B — Technical Implementation

## 7. Tech Stack

- **Frontend + backend:** Next.js (App Router), API Routes for backend logic.
- **Database:** PostgreSQL.
- **Authorisation:** sessions with role-based access (owner / seller) — details in 9.
- **Charts:** a charting library (e.g. Recharts).
- **Money — integer minor units (cross-cutting rule):** all monetary values (prices, totals, compensation) are stored as an integer number of kopecks/cents, never as floating point, to avoid rounding errors. Integer minor units were chosen (rather than numeric) because calculations live in JS, which has no exact decimal type: integers stay exact both in the database and in code. Conversion to decimals and the currency symbol happen only at the display layer.
  - *Note:* profitability and shares produce fractional results (half-kopecks) — the rounding rule is defined below.
- **Money rounding and parsing (cross-cutting rule):**
  - Fractions are allowed only inside a calculation and are rounded once, at the end, half away from zero (0.5 kopeck → 1).
  - VAT is calculated per document line; the document total is the sum of the rounded lines, so parts always sum to the whole.
  - Percentages and averages in analytics (margin %, average price) are display metrics, not money: computed as regular numbers, rounded only for display.
  - All money handling (conversion, rounding, formatting) lives in one module, money.ts, with mandatory unit tests.
  - **Parsing user input:** never parseFloat the raw input — parseFloat('105,50') returns 105 and silently drops the kopecks. Steps: normalise the string (remove spaces, comma → dot), validate the format in the Zod schema (digits, at most two decimal places — otherwise a validation error, never silent truncation), then convert with Math.round(Number(s) * 100). With at most two decimals Math.round is always exact.
- **Business time zone (cross-cutting rule):**
  - Each business has a time zone setting (IANA, default Europe/Kyiv), independent of the device clock — an owner on holiday in another zone sees the same days as the shop.
  - Everything about a 'day' or 'month' is computed in the business time zone: matrix columns, daily cash reconciliation, 'since start of month' in restock rules, monthly reports, automatic month close.
  - Exact moments (audit log, document creation) are stored in UTC (timestamptz) and displayed in the business time zone — for all users, so the whole system shows one time zone.
  - The date of a matrix sale is a date without time ([sales.sale](http://sales.sale)_date, Postgres date): the owner records how many were sold on this day, not at what time. When it was entered is created_at. In the log: 'Sale for 08.10, entered 11.10 at 19:42'.
  - **Date-only values must never become a JS Date** on the client: it binds them to midnight in the browser's zone, and in some zones '8 October' silently becomes '7 October'. Keep them as 'YYYY-MM-DD' strings; in Drizzle use the date column with mode: 'string'.
  - Changing the business time zone later breaks nothing: sale dates stay as they are, exact moments are simply displayed in the new zone.
- **Currency:** one currency per business (setting, ISO 4217, default UAH). It affects display only — symbol and number format via Intl.NumberFormat with the UI locale. Storage is unchanged: integer minor units. Multi-currency — see 6.

## 8. Libraries and Tools (Specifics for Claude Code)

- **ORM / database access — Drizzle.** Lighter and closer to SQL than Prisma, faster cold start on serverless (important for Vercel + Neon, which both recommend it).
- **Validation — Zod.** De facto standard: one schema validates both form data and API input; fits TypeScript well.
- **Styling and components — Tailwind + shadcn/ui.** Clean look without building every component from scratch; the most popular pair in the Next ecosystem.
- **Drag & drop — dnd-kit.** For reordering categories and subcategories in settings; lightweight, supports sortable lists, keyboard and touch.
- **Themes — next-themes.** The standard choice for shadcn/ui: light / dark / system, no flash on load (see 13).
- **Colour handling — culori.** Generating a shade scale from a brand colour (in OKLCH) and checking contrast (see 13).
- **Error monitoring — Sentry (@sentry/nextjs).** Client and server errors with source maps (see 12.7).
- **Client state and data fetching — TanStack Query (React Query).** Caches and refreshes server data (stock, sales, reference data), works well with the matrix's offline queue. Local UI state — built into React; no separate Redux needed.
- **PDF generation — React-pdf / Puppeteer (HTML → PDF).** Stocktake reports, transfer and receipt documents. Caution: a heavy PDF may hit the Vercel function limit (60 s Hobby / 300 s Pro) — design heavy generation carefully, possibly in the background.
- **Localisation — next-intl.** Built for App Router, keeps translations in files, switches language and persists the choice.
- **Tests — Vitest (unit/integration) + Playwright (E2E).** Vitest is added alongside purely for tests — the project doesn't need to be on Vite (Next has its own build); they run in parallel.
- **Database migrations — Drizzle Kit (built into Drizzle).** Change the schema in code → Drizzle Kit generates a numbered migration file; the database tracks which migrations have been applied and never applies one twice. One command on update (can run in CI/CD) — this also covers the "run migrations on each installation separately" caveat. Note: on a production database with live data, review complex migrations (renaming / dropping columns) by eye before running them, to avoid data loss.

## 9. Authentication and Login Security

- **Passwords — bcrypt hash (mandatory):** passwords are never stored in plain text, only as an irreversible hash (bcrypt).
- **Sessions and cookies (mandatory):** the server holds the session, the browser holds the key in a cookie. Cookie is **httpOnly** (inaccessible from JS, protection against script theft) and **secure** (HTTPS only). Lifetime — 1–2 weeks, extended on activity.
- **At launch:** login, password change in profile, password recovery via email.
- **After MVP:** seller management (owner creates accounts and grants access) — when the second role is introduced. At launch only the owner works (one account).
- **Password recovery:** the reset token is **single-use with a short lifetime** (1–2 hours), so a link from an email doesn't stay valid forever.
- **Email service — Resend:** for password reset emails. Chosen for its free tier (3,000 emails/month, 100/day, no time limit) and easy Next.js integration — ample for one shop. API keys in config; raise the plan if volume grows.

## 10. Testing

A mandatory part of development, three levels with different requirements.

- **Unit tests — mandatory for business logic** (where money and stock are calculated): stock recalculation, profitability at historical price, restock rules, merging offline sales with duplicate protection.
- **Integration tests — for key end-to-end scenarios** (action → database record): goods receipt, posting sales, stocktake with adjustment, transfer.
- **End-to-end (E2E, through the UI) — selectively**, only for the most critical flows, as they are expensive to maintain.

## 11. Data Model (Draft)

> **Cross-cutting rule — timestamps:** every table has created_at and updated_at, even where the list below doesn't mention them. PostgreSQL doesn't add them on its own, so they are declared via a shared helper in the Drizzle schema that every table includes. created_at — DEFAULT now() (the database sets it on insert). updated_at — maintained via Drizzle's $onUpdate; this only fires for changes made through Drizzle, so direct SQL changes (data migrations, manual fixes) must set it explicitly. If a database-level guarantee is ever needed — a PostgreSQL trigger.

- **businesses** — id, name, vat_enabled, vat_rate, archive_period_products (default 1 month), archive_period_suppliers (default 3 months), timezone (IANA, default Europe/Kyiv), currency (ISO 4217, default UAH), suppliers_enabled (default true), period_lock_grace_days (default 5), primary_color (hex, nullable — main brand colour), accent_color (hex, nullable — accent), logo (bytea, nullable), logo_mime_type (nullable), created_at — business settings (archive-candidate periods here; restock rule defaults in restock_rules).
- **locations** — id, business_id, name, type (shop/warehouse).
- **categories** — id, business_id, name, parent_id (nullable — empty for a category, set for a subcategory), sort_order (display order within the parent; changed via drag & drop in settings; named sort_order rather than order because ORDER is a reserved SQL word), archived.
- **users** — id, business_id, email, password_hash (bcrypt), role (owner/seller), theme (light/dark/system, default system), created_at. Sessions are server-side, key in an httpOnly secure cookie. Password reset tokens are single-use, short-lived (see 9).
- **products** — id, business_id, name, sku, category_id (reference to categories — the product's most specific category: the subcategory if there is one, otherwise the category), min_stock, default_supplier_id (nullable — main supplier; defaults to the supplier of the latest receipt, editable), velocity_threshold_pct (nullable — per-product override of the activity threshold; empty → business default applies), needs_review (flag "created quickly from a receipt, worth reviewing"), archived.
- **price_history** — id, product_id, purchase_price, sale_price, effective_from (price start date).
- **suppliers** — id, business_id, name, contacts (phone/email/etc.), note, is_system (hidden system supplier used when supplier tracking is off; not editable or deletable), needs_review (flag "created on the fly with just a name, worth reviewing") — supplier reference list.
- **purchases** — id, business_id, supplier_id, default_location_id (default destination for new lines), created_by (user_id), created_at — goods receipt header.
- **purchase_items** — id, purchase_id, product_id, location_id (destination of this line), quantity, purchase_price, sale_price (nullable — may be empty, set later) — receipt lines, feed price_history.
- **inventory** — product_id, location_id, quantity (stock at a specific location), last_movement_at (date of last stock change — so the archive-candidate filter doesn't recompute from the log every time).
- **cash_adjustments** — id, business_id, location_id, date, amount (adjustment — usually negative, total discounts), note, created_by — daily adjustment to cash reconciliation at launch (until receipt-level discount tracking exists).
- **sales** — id, product_id, location_id (shop), quantity, sold_by (user_id), sale_date (date without time — the business day the sale belongs to, see 7; entry time is created_at), unit_price, unit_cost (historical purchase price at time of sale), payment_method (cash/card/future, nullable — filled when the matrix's per-cell cash/card split is on), client_uuid (nullable, unique — device-side identifier for duplicate-free offline sync).
- **restock_lists** — id, business_id, title (nullable), status (draft/ordered/done/archived), created_by — a saved restock list (document); the suggestion itself is computed on the fly and not stored.
- **restock_list_items** — id, restock_list_id, product_id, quantity, supplier_id (nullable — defaults to the product's main supplier, can be changed per row), source (rule/manual), rule_id (nullable — which rule suggested it), done (set when the item arrives via a receipt).
- **period_unlocks** — id, business_id, location_id (nullable), period_start, period_end, reason, opened_by, expires_at (opened + 24 h) — manual reopening of a closed period (see 4.5).
- **restock_rules** — id, business_id, rule_type (min_stock / sales_velocity_month / future), threshold (units for min_stock; percentage — default 50% — for sales_velocity_month), period (day/week/month — for future velocity rules; the activity rule counts from start of month), enabled — business-level rule defaults (per-product overrides in products).
- **stock_adjustments** — id, product_id, location_id, old_quantity, new_quantity, reason (breakage/shortage/mis-sort/other), adjusted_by (user_id), adjusted_at, stocktake_id (nullable — link to stocktake if the adjustment came from one) — manual stock adjustments.
- **stocktakes** — id, business_id, location_id, status (draft/posted), created_by (user_id), created_at, completed_at — full stocktake header.
- **stocktake_items** — id, stocktake_id, product_id, system_quantity (system stock at time of count), counted_quantity (actual), difference — stocktake lines; differences feed stock_adjustments on posting.
- **transfers** — id, business_id, from_location_id, to_location_id, created_by (user_id), created_at — transfer document header.
- **transfer_items** — id, transfer_id, product_id, quantity — lines within one document.
- **returns** — id, sale_id, product_id, location_id, quantity, type (resellable/defective_replacement/defective_writeoff), refund_amount (amount refunded), refund_method (cash/card — how it was paid back, independent of original payment), reason, created_by (user_id), created_at — customer return; resellable goes back to inventory, defective does not.
- **supplier_replacements** — id, return_id, product_id, status (awaiting_replacement/resolved), resolution_type (same/substitute/money), replacement_product_id (for substitute), replacement_quantity, refund_amount (for money), resolved_at — defective-for-replacement record and loop closure.
- **audit_log** — id, business_id, user_id, action_type, entity_type, entity_id, product_id, old_value, new_value, reason, created_at — log of all state-changing actions; separate fields for filtering and analytics.

## 12. Scaling and Deployment Decisions

### 12.1 VAT

- VAT is configurable (on / off), off by default.
- The VAT rate lives in config (may differ between shops).
- The current shop doesn't need VAT, but it is provided for future sale of the product to other shops.

### 12.2 Multiple Shops and Warehouses

- A "location" entity with a type: shop or warehouse. Built into the data model from the start.
- One business can have several shops AND several warehouses — shop and warehouse are different location types, not the same thing.
- At launch the current business has one site, but the schema must support several locations of each type.
- Stock is tied to a specific location; sales and analytics to a shop. Scaling to several locations won't break the schema.

### 12.3 Price History

- A separate price history table: every change of purchase and sale price with its date.
- Profitability analytics uses the historical price at the time of sale, not the current one.

### 12.4 Deployment and Updates

- Model: "one installation per business" at launch, but a business/site field is built into the data model so moving to multi-tenancy is an evolution, not a rewrite.
- **Two stages — a deliberate plan (project context: a learning pet project for the portfolio + real use by a friend):**
  - **Development stage — Vercel.** While the functionality is being built, deploy straight from GitHub (push to main → auto build), without Docker and without a custom CI/CD. Goal — focus on Next.js and business logic, zero infrastructure hassle.
  - **Maturity stage — Docker + GitHub Actions, hosted on Railway.** Once the app is stable, package it as a Docker image and build a real pipeline (tests and linter, image build, deploy). This is a separate deliberate step — and the main portfolio showcase (containerisation and CI/CD skills), not a burden from day one.
- **CI/CD (maturity stage) — GitHub Actions:** on every push, Vitest tests (see 10) and the linter run, a Docker image is built, and Railway picks it up for deployment. The tests from section 10 become part of the pipeline rather than sitting separately.
- Kubernetes / orchestration — a future direction when there are many clients; not at launch.
- Caution: database schema migrations must be run on each installation separately — containers don't solve this automatically. Implementation — Drizzle Kit, one command on update (see 8).

### 12.5 Hosting

- **Development stage — Vercel.** Native to Next.js, deployment straight from GitHub, free Hobby plan (100 GB traffic, 1M function invocations — plenty of headroom). Convenient while functionality is being built. Downside for this project's goals: it hides the entire deployment layer, so there's nothing to show in terms of infrastructure skills — hence the move at the next stage.
  - *Limit to remember:* a Vercel function must complete within 60 s (Hobby) / 300 s (Pro) — important for generating large PDFs / heavy reports.
- **Maturity stage — Railway ($5/month, Hobby plan).** Accepts a Docker image, PostgreSQL is added in one click in the same project (connection string automatically in env vars), **no sleeping** — the app is always live. Chosen deliberately: free container tiers have effectively disappeared in 2026 (Railway and [Fly.io](http://Fly.io) dropped their free tiers; Render free sleeps after 15 min idle and takes 30–60 s to wake — unacceptable since the friend actually uses the app). For $5 — a live service for her + real Docker and a self-managed database for the portfolio.
  - *Alternatives considered:* [Fly.io](http://Fly.io) (pay-as-you-go, \~$5, the most "Docker-centric", but more manual work with fly.toml); Render paid instance (\~$7, no sleeping). Railway chosen for its balance of convenience and control.
- **Database — PostgreSQL on Railway** (at the maturity stage, together with the app). During development on Vercel the database can live on Neon (free PostgreSQL, no card required) — at the move, data is carried over via Drizzle migrations.
- **Migration:** standard Next.js is not locked to any platform — the Docker image moves between Railway, Render, [Fly.io](http://Fly.io) or a VPS without rewriting (the door stays open).

### 12.6 Backups

Real shop data — backups are mandatory.

- **Railway volume backups — all three schedules on:** daily (kept 6 days), weekly (kept 1 month), monthly (kept 3 months). One-click restore. (Railway support says these are available on Hobby — verify when setting up.)
- **Caveat:** deleting the volume or project deletes its backups too. They protect against 'broke the data', not against losing the account or deleting the project.
- **Off-site nightly dump via GitHub Actions:** a scheduled workflow runs pg_dump, encrypts the dump and stores it outside Railway. Provider-independent — works the same on Neon during development and on Railway later. The encryption key lives in GitHub secrets, with a separate copy kept by the repo owner (otherwise the dump cannot be decrypted).
- **Point-in-time recovery (PITR):** not at launch — with data entered once a day, daily backups are enough.
- **Restore drill:** before real use starts, restore a backup into a separate environment and confirm everything comes up.

### 12.7 Error Monitoring

- **Sentry** (free Developer plan, \~5,000 errors/month, 1 user — verify on Sentry's site) via @sentry/nextjs: client and server errors.
- Source maps are uploaded at build time so errors point to the original code lines.
- Email alerts to the developer.
- **No personal data in reports:** no passwords, emails or tokens. Product names and amounts are fine.

## 13. Design and Theming

There is no dedicated designer: the base look is shadcn/ui; branding is done through colours and a logo at the business level.

### 13.1 Business Brand Colours

- Each business stores two colours: **primary** and **accent**. The rest of the palette (background, text, borders, semantic colours) is system-defined and identical for all businesses.
- **Current shop (from its signage):** primary — light green #A4C639, accent — orange #FF7E00.
- **Implementation:** the business colours are injected into the shadcn/ui theme CSS variables on load; components know nothing about specific colours.
- Primary — buttons, active menu item, focus, selection. Accent — used sparingly: badges, secondary highlights, charts.
- If no colours are set — a neutral system palette.

### 13.2 Contrast and Derived Shades

- Both of the current shop's colours are light: **white text on them is not readable** (contrast \~2:1 on the green, \~2.5:1 on the orange, against the WCAG requirement of 4.5:1), while dark text reads well (\~10:1 and \~8:1).
- Therefore **text on a brand-coloured fill is chosen automatically** — black or white, whichever gives higher contrast. This works for any colour of any business.
- For brand-coloured text and links on a light background, a darker shade is generated from the base colour (a lightness scale in OKLCH), since the light green itself is not readable on white.
- When choosing a colour in settings, a warning is shown if contrast is insufficient.

### 13.3 Semantic Colours Are Independent of the Brand

- Error, warning and success are fixed system colours, the same for all businesses: negative stock, stocktake discrepancies and "needs review" must look the same in every shop.
- The brand orange is close to a typical warning colour, and the green is close to a success colour. Therefore **critical signals (negative stock, discrepancies) use a clear red**, not orange; success messages are neutral or icon-based so they don't blend with the brand green.

### 13.4 Dark Mode

- Light and dark themes from the start. The choice belongs to the user (not the business): light / dark / system, default system. Stored in the profile (users.theme).
- Switching — next-themes.
- Brand colours work in both themes: both read well on a dark background. Derived shades (13.2) are generated separately for each theme.

### 13.5 Business Logo

- An optional logo in business settings; shown in the app header and on PDF documents (stocktake reports, transfer and receipt documents).
- **Formats — PNG, JPG, WebP; size up to \~1 MB.** SVG is not accepted: it can contain scripts (XSS risk), and React-pdf doesn't accept SVG as an image anyway.
- **Stored directly in PostgreSQL (bytea)** and served by a dedicated endpoint with caching. No separate file storage: one small file per business doesn't need it, and the logo moves from Vercel to Railway together with the database.
- A transparent logo may disappear on a dark background, so in dark mode it is shown on a light backing.
- **Chosen logo (current shop): 'pinnate leaf'** — an ash compound leaf (green leaflet pairs, orange terminal leaflet, stem in the ink colour) plus the wordmark 'Ясен' in Unbounded SemiBold and the tagline 'ГОСПОДАРСЬКІ ТОВАРИ' in Manrope Bold. Final files exist: light and dark lockups, mark only, SVG with text outlined, PNG.
- **Favicon and app icons** come from the same set and live in /public: favicon.svg (switches the stem colour for light / dark browser themes via prefers-color-scheme), favicon.ico (16/32/48 px, for older browsers), apple-touch-icon.png (180 px, mark on white).

## 14. Release Plan

Build in stages, from what the owner needs to start using the app. The data model (11) is the target, not the first migration: tables are added with the stage that needs them, but cross-cutting rules apply from stage 0.

- **0. Foundation:** Next.js + Drizzle + Neon, deploy to Vercel; owner login, password change and reset (Resend); money.ts, business time zone helpers, timestamps helper, audit log, next-intl (en/uk/ru), light/dark theme; Sentry, Vitest, nightly encrypted pg_dump.
- **1. MVP — the owner starts using it:** locations, categories with order, products, archive, CSV import; suppliers (always on); goods receipts with location per line and split; sales matrix with cash/card split, client_uuid and append-only writes; daily cash summary + discount adjustment; stock view with negatives highlighted; manual adjustments; transfers. Customer returns are covered by manual adjustments until stage 3.
- **2. Offline sales matrix:** Service Worker, IndexedDB queue, sync. Because the MVP matrix is already append-only with client_uuid, this stage adds no rework to the matrix itself.
- **3. Control:** stocktakes + PDF act, customer returns + supplier replacements, restock lists, corrections of posted documents + period closing, export (PDF/Excel), monthly report.
- **4. Analytics & settings:** dashboard, profitability, discrepancy analytics, brand colours + logo upload, archive / needs-review filters, optional supplier tracking.
- **5. Maturity:** Docker, GitHub Actions CI/CD, move to Railway, Railway backups + restore drill.

## 15. Claude Code Setup

The repository carries its own Claude Code configuration (prepared separately as files):

- [**CLAUDE.md**](http://CLAUDE.md) (\~80 lines, loaded every session): project, stack, commands, cross-cutting rules, workflow. Points to docs/spec/[technical.md](http://technical.md) and docs/spec/[business.md](http://business.md) (an English export of these Notion pages) without importing them.
- **docs/CURRENT_**[**STAGE.md**](http://STAGE.md)**:** the current stage from section 14. Claude builds only what it lists; moving to the next stage = editing this file.
- **.claude/rules/:** [db.md](http://db.md) (schema and migrations) and [ui.md](http://ui.md) (components) — loaded only for matching paths.
- **Skills:** add-feature (schema → migration → Zod → service → server action with permission check and audit log → UI → translations → tests), db-migration (generate, review destructive SQL, apply), i18n-sync, add-export, spec-update.
- **Hooks:** block edits to .env* and committed migrations; block drizzle-kit push, DROP / TRUNCATE, production DB URLs, force push; Prettier + ESLint after every edit with remaining errors sent back to Claude; typecheck + unit tests before finishing (up to 3 retries); re-inject the current stage and key rules after context compaction.
- **ESLint** holds the code-level rules so they also apply to manual edits and CI: no parseFloat / toFixed for money, no hex colours, no new Date('YYYY-MM-DD'), no database imports in UI code, no literal UI text (eslint-plugin-i18next), no floating promises.
