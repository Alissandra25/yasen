import { index, integer, pgTable, serial } from "drizzle-orm/pg-core";
import { locationsTable } from "./locations";
import { productsTable } from "./products";
import { purchasesTable } from "./purchases";
import { timestamps } from "./_shared/timestamps";

// One line per product per location within a receipt (spec 3.3) — splitting one product across
// locations is several lines, not a quantity-per-location column. sale_price is nullable (can be
// set later); purchase_price is always required, matching price_history's own shape.
export const purchaseItemsTable = pgTable(
  "purchase_items",
  {
    id: serial("id").primaryKey(),
    purchaseId: integer("purchase_id")
      .notNull()
      .references(() => purchasesTable.id),
    productId: integer("product_id")
      .notNull()
      .references(() => productsTable.id),
    locationId: integer("location_id")
      .notNull()
      .references(() => locationsTable.id),
    quantity: integer("quantity").notNull(),
    purchasePrice: integer("purchase_price").notNull(),
    salePrice: integer("sale_price"),
    ...timestamps,
  },
  (table) => [
    index("purchase_items_purchase_id_idx").on(table.purchaseId),
    index("purchase_items_product_id_idx").on(table.productId),
  ],
);
