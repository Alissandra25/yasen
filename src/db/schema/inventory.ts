import {
  index,
  integer,
  pgTable,
  primaryKey,
  timestamp,
} from "drizzle-orm/pg-core";
import { locationsTable } from "./locations";
import { productsTable } from "./products";
import { timestamps } from "./_shared/timestamps";

// Composite PK (product_id, location_id) — one row per product per location, not a serial id.
// last_movement_at is null until the first stock-moving action touches this row (nothing does
// yet: receipts, sales, adjustments and transfers all land in later milestones), so the
// archive-candidate query below treats "never moved" as "too new to judge", not "a candidate".
export const inventoryTable = pgTable(
  "inventory",
  {
    productId: integer("product_id")
      .notNull()
      .references(() => productsTable.id),
    locationId: integer("location_id")
      .notNull()
      .references(() => locationsTable.id),
    quantity: integer("quantity").notNull().default(0),
    lastMovementAt: timestamp("last_movement_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    primaryKey({ columns: [table.productId, table.locationId] }),
    index("inventory_location_id_idx").on(table.locationId),
  ],
);
