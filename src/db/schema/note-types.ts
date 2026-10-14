import { index, integer, pgTable, serial, varchar } from "drizzle-orm/pg-core";
import { businessesTable } from "./businesses";
import { timestamps } from "./_shared/timestamps";

// Per-business reference list of note types (spec 11), mirroring the ink colours the owner used
// in the paper notebooks. color is a hex string chosen freely per business — like
// businesses.primary_color/accent_color (spec 13.1), it's a stored value, not a design-system
// token, so components render it directly (e.g. inline style) rather than through a Tailwind
// color class.
export const noteTypesTable = pgTable(
  "note_types",
  {
    id: serial("id").primaryKey(),
    businessId: integer("business_id")
      .notNull()
      .references(() => businessesTable.id),
    name: varchar("name", { length: 100 }).notNull(),
    color: varchar("color", { length: 7 }).notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps,
  },
  (table) => [index("note_types_business_id_idx").on(table.businessId)],
);
