# Seed data — Ясен catalogue (dev only)

Realistic but invented catalogue for local development and testing: 12 categories, 54 subcategories, ~1 750 products, 9 suppliers. Suppliers, prices and stock are made up; e-mails use the reserved `.example` domain. Not for production.

## Files

- `categories.json` — the tree, in display order: `[{ "name", "subcategories": [names] }]`. `sort_order` = position in the array (top level among themselves, subcategories within their parent). All names are unique across the whole tree, because the CSV import matches a category by name.
- `suppliers.json` — `[{ "name", "contacts", "note" }]`.
- `products.csv` — one row per product. Columns:
  - `name`, `sku` (unique), `supplier` (name from `suppliers.json` → `default_supplier_id`);
  - `category` — the **subcategory** name (the product's most specific category);
  - `unit` — `pcs | pack | m | m2 | kg | l` (spec 3.1);
  - `minStock` — whole number in the product's unit;
  - `purchasePrice`, `salePrice` — UAH with a dot, e.g. `46.00`; parse with `parseMoney`. A few rows have an empty `salePrice` on purpose (allowed by the spec);
  - `stockWarehouse`, `stockShop` — starting stock for the locations «Склад» and «Магазин»; decimals only for m / m2 / kg. Convert with `quantity.ts` (integer thousandths). About 25 products have zero stock everywhere (archive-candidate testing).

The first seven columns match the product CSV import (`importProductsCsvAction`), so `products.csv` can also be uploaded through the UI once the categories exist; the import ignores `unit` and the stock columns.

## Suggested seed order

1. Business, owner, system supplier (existing `scripts/seed.mts`).
2. Locations «Склад» (warehouse) and «Магазин» (shop) if missing.
3. Categories from `categories.json`.
4. Suppliers from `suppliers.json`.
5. Products from `products.csv` + one `price_history` row each (`effective_from` = today) + `inventory` rows for both locations.

Make the seed idempotent (skip by category name / supplier name / product SKU), like `seed.mts`. Starting stock should go in as stock adjustments with a reason (or a single opening receipt) rather than raw `inventory` inserts, if the audit log must stay consistent — for a throwaway dev database raw inserts are fine.
