---
name: add-export
description: Add a new report or printable document to the shared export mechanism (PDF and Excel/CSV). Use when a feature needs a downloadable or printable output.
---

# Add an export

Every report goes through the shared export layer (spec 3.9): one data builder, several renderers. Any report can be exported to PDF and to Excel/CSV.

1. **Data builder.** In `src/server/exports/<report>.ts`, write a function that takes filters (period, location, …) and returns a plain, typed structure: title, columns, rows, totals. Money stays in kopecks here; dates as `YYYY-MM-DD`. No formatting.

2. **Register it** in the export registry so both renderers pick it up.

3. **Renderers** use the shared formatters: money via `money.ts`, dates in the business time zone via `dates.ts`, labels via next-intl in the user's language. The PDF includes the business name, logo (if set) and the period.

4. **Limits.** PDF generation must finish within the hosting function limit (60 s on Vercel Hobby). For large reports, paginate the query and stream; don't load every row into memory.

5. **Tests.** Unit-test the data builder: totals equal the sum of rows, filters respected, business time zone at period edges.

6. **Permissions.** Analytics exports are owner-only; check the permission in the route or action that serves the file.
