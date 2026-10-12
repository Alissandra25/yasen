import { date, index, integer, pgTable, serial } from "drizzle-orm/pg-core";
import { productsTable } from "./products";
import { timestamps } from "./_shared/timestamps";

// purchase_price is always required (a receipt always provides it, spec 3.3); sale_price can be
// left null and set later. A row is only ever inserted when purchase_price is known — there's no
// such thing as a price_history entry with just a sale price.
export const priceHistoryTable = pgTable(
  "price_history",
  {
    id: serial("id").primaryKey(),
    productId: integer("product_id")
      .notNull()
      .references(() => productsTable.id),
    purchasePrice: integer("purchase_price").notNull(),
    salePrice: integer("sale_price"),
    effectiveFrom: date("effective_from", { mode: "string" }).notNull(),
    ...timestamps,
  },
  (table) => [index("price_history_product_id_idx").on(table.productId)],
);
