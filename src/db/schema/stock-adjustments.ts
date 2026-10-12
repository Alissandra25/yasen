import {
  index,
  integer,
  pgEnum,
  pgTable,
  serial,
  timestamp,
} from "drizzle-orm/pg-core";
import { locationsTable } from "./locations";
import { productsTable } from "./products";
import { usersTable } from "./users";
import { timestamps } from "./_shared/timestamps";

// breakage/shortage/mis-sort/other, per spec 4.1.
export const stockAdjustmentReasonEnum = pgEnum("stock_adjustment_reason", [
  "breakage",
  "shortage",
  "mis_sort",
  "other",
]);

// No business_id or stocktake_id yet: scoped via product_id -> products.business_id, same
// precedent as inventory/purchase_items/sales. stocktake_id (spec 11: "link to stocktake if the
// adjustment came from one") is deliberately deferred until Stage 3's stocktakes table exists —
// adding an unconstrained integer "FK" to a table that doesn't exist yet would be a foot-gun,
// not a real reference.
export const stockAdjustmentsTable = pgTable(
  "stock_adjustments",
  {
    id: serial("id").primaryKey(),
    productId: integer("product_id")
      .notNull()
      .references(() => productsTable.id),
    locationId: integer("location_id")
      .notNull()
      .references(() => locationsTable.id),
    oldQuantity: integer("old_quantity").notNull(),
    newQuantity: integer("new_quantity").notNull(),
    reason: stockAdjustmentReasonEnum("reason").notNull(),
    adjustedBy: integer("adjusted_by")
      .notNull()
      .references(() => usersTable.id),
    adjustedAt: timestamp("adjusted_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    ...timestamps,
  },
  (table) => [
    index("stock_adjustments_product_id_idx").on(table.productId),
    index("stock_adjustments_location_id_idx").on(table.locationId),
  ],
);
