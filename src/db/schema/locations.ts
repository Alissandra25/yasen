import {
  index,
  integer,
  pgEnum,
  pgTable,
  serial,
  varchar,
} from "drizzle-orm/pg-core";
import { businessesTable } from "./businesses";
import { timestamps } from "./_shared/timestamps";

// A business can have several shops and several warehouses (spec 12.2); at launch there's one of
// each, but nothing here assumes that.
export const locationTypeEnum = pgEnum("location_type", ["shop", "warehouse"]);

export const locationsTable = pgTable(
  "locations",
  {
    id: serial("id").primaryKey(),
    businessId: integer("business_id")
      .notNull()
      .references(() => businessesTable.id),
    name: varchar("name", { length: 255 }).notNull(),
    type: locationTypeEnum("type").notNull(),
    ...timestamps,
  },
  (table) => [index("locations_business_id_idx").on(table.businessId)],
);
