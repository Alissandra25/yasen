import {
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  serial,
  varchar,
} from "drizzle-orm/pg-core";
import { locationsTable } from "./locations";
import { productsTable } from "./products";
import { usersTable } from "./users";
import { timestamps } from "./_shared/timestamps";

// cash/future(e.g. transfer) per spec 11; only cash/card exist at launch.
export const paymentMethodEnum = pgEnum("payment_method", ["cash", "card"]);

// No business_id: reachable via product_id -> products.business_id, same precedent as
// inventory and purchase_items. Append-only (spec 3.6/CLAUDE.md): a matrix cell edit never
// updates an existing row, it inserts a new signed-quantity delta row — client_uuid gives each
// insert idempotent retry protection, ready for the Stage 2 offline queue with no rework.
// sale_date is the business day the sale belongs to (date-only); created_at is when it was
// entered, which can be a different, later day.
export const salesTable = pgTable(
  "sales",
  {
    id: serial("id").primaryKey(),
    productId: integer("product_id")
      .notNull()
      .references(() => productsTable.id),
    locationId: integer("location_id")
      .notNull()
      .references(() => locationsTable.id),
    quantity: integer("quantity").notNull(),
    soldBy: integer("sold_by")
      .notNull()
      .references(() => usersTable.id),
    saleDate: date("sale_date", { mode: "string" }).notNull(),
    unitPrice: integer("unit_price").notNull(),
    unitCost: integer("unit_cost").notNull(),
    paymentMethod: paymentMethodEnum("payment_method"),
    clientUuid: varchar("client_uuid", { length: 36 }).unique(),
    ...timestamps,
  },
  (table) => [
    index("sales_product_id_idx").on(table.productId),
    index("sales_location_id_idx").on(table.locationId),
    index("sales_sale_date_idx").on(table.saleDate),
  ],
);
