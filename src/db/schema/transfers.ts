import { index, integer, pgTable, serial } from "drizzle-orm/pg-core";
import { businessesTable } from "./businesses";
import { locationsTable } from "./locations";
import { usersTable } from "./users";
import { timestamps } from "./_shared/timestamps";

// Transfer document header (spec 4.2): one document per transfer, not a form per product.
export const transfersTable = pgTable(
  "transfers",
  {
    id: serial("id").primaryKey(),
    businessId: integer("business_id")
      .notNull()
      .references(() => businessesTable.id),
    fromLocationId: integer("from_location_id")
      .notNull()
      .references(() => locationsTable.id),
    toLocationId: integer("to_location_id")
      .notNull()
      .references(() => locationsTable.id),
    createdBy: integer("created_by")
      .notNull()
      .references(() => usersTable.id),
    ...timestamps,
  },
  (table) => [
    index("transfers_business_id_idx").on(table.businessId),
    index("transfers_from_location_id_idx").on(table.fromLocationId),
    index("transfers_to_location_id_idx").on(table.toLocationId),
  ],
);
