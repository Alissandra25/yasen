import { index, integer, pgTable, serial } from "drizzle-orm/pg-core";
import { stockAdjustmentReasonEnum } from "./stock-adjustments";
import { stocktakesTable } from "./stocktakes";
import { productsTable } from "./products";
import { timestamps } from "./_shared/timestamps";

// Stocktake lines (spec 4.1 / 11): system_quantity is a snapshot taken when the stocktake
// starts; counted_quantity stays null until the owner enters it (uncounted lines are skipped on
// posting, not treated as a zero count). difference is counted_quantity - system_quantity,
// recomputed whenever counted_quantity changes rather than trusted as stored state.
export const stocktakeItemsTable = pgTable(
  "stocktake_items",
  {
    id: serial("id").primaryKey(),
    stocktakeId: integer("stocktake_id")
      .notNull()
      .references(() => stocktakesTable.id),
    productId: integer("product_id")
      .notNull()
      .references(() => productsTable.id),
    systemQuantity: integer("system_quantity").notNull(),
    countedQuantity: integer("counted_quantity"),
    reason: stockAdjustmentReasonEnum("reason"),
    ...timestamps,
  },
  (table) => [
    index("stocktake_items_stocktake_id_idx").on(table.stocktakeId),
    index("stocktake_items_product_id_idx").on(table.productId),
  ],
);
