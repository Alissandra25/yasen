import { index, integer, pgTable, serial } from "drizzle-orm/pg-core";
import { businessesTable } from "./businesses";
import { locationsTable } from "./locations";
import { suppliersTable } from "./suppliers";
import { usersTable } from "./users";
import { timestamps } from "./_shared/timestamps";

// Goods receipt header (spec 3.3): one document per delivery. default_location_id prefills new
// lines' destination; a line can still pick a different location (or be split across several).
export const purchasesTable = pgTable(
  "purchases",
  {
    id: serial("id").primaryKey(),
    businessId: integer("business_id")
      .notNull()
      .references(() => businessesTable.id),
    supplierId: integer("supplier_id")
      .notNull()
      .references(() => suppliersTable.id),
    defaultLocationId: integer("default_location_id")
      .notNull()
      .references(() => locationsTable.id),
    createdBy: integer("created_by")
      .notNull()
      .references(() => usersTable.id),
    ...timestamps,
  },
  (table) => [
    index("purchases_business_id_idx").on(table.businessId),
    index("purchases_supplier_id_idx").on(table.supplierId),
  ],
);
