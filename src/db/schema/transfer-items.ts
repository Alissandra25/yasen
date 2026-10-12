import { index, integer, pgTable, serial } from "drizzle-orm/pg-core";
import { productsTable } from "./products";
import { transfersTable } from "./transfers";
import { timestamps } from "./_shared/timestamps";

// Lines within one transfer document (spec 11). No location columns: both locations live on
// the header, since a transfer is always between the same two locations for every line.
export const transferItemsTable = pgTable(
  "transfer_items",
  {
    id: serial("id").primaryKey(),
    transferId: integer("transfer_id")
      .notNull()
      .references(() => transfersTable.id),
    productId: integer("product_id")
      .notNull()
      .references(() => productsTable.id),
    quantity: integer("quantity").notNull(),
    ...timestamps,
  },
  (table) => [
    index("transfer_items_transfer_id_idx").on(table.transferId),
    index("transfer_items_product_id_idx").on(table.productId),
  ],
);
