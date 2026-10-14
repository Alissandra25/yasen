import {
  index,
  integer,
  pgEnum,
  pgTable,
  serial,
  timestamp,
} from "drizzle-orm/pg-core";
import { businessesTable } from "./businesses";
import { locationsTable } from "./locations";
import { usersTable } from "./users";
import { timestamps } from "./_shared/timestamps";

// Full stocktake header (spec 4.1 / 11): a bulk recount of one location, saved as a document so
// it can be revisited and compared month to month.
export const stocktakeStatusEnum = pgEnum("stocktake_status", [
  "draft",
  "posted",
]);

export const stocktakesTable = pgTable(
  "stocktakes",
  {
    id: serial("id").primaryKey(),
    businessId: integer("business_id")
      .notNull()
      .references(() => businessesTable.id),
    locationId: integer("location_id")
      .notNull()
      .references(() => locationsTable.id),
    status: stocktakeStatusEnum("status").notNull().default("draft"),
    createdBy: integer("created_by")
      .notNull()
      .references(() => usersTable.id),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    index("stocktakes_business_id_idx").on(table.businessId),
    index("stocktakes_location_id_idx").on(table.locationId),
  ],
);
