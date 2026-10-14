import {
  index,
  integer,
  pgTable,
  serial,
  text,
  varchar,
} from "drizzle-orm/pg-core";
import { businessesTable } from "./businesses";
import { noteTypesTable } from "./note-types";
import { productsTable } from "./products";
import { usersTable } from "./users";
import { timestamps } from "./_shared/timestamps";

// Replaces the paper notebooks' different ink colours (spec 3.5.1 / 11). valid_from/valid_to are
// 'YYYY-MM' month strings, not dates — the "carry over to next month" toggle maps directly onto
// valid_to: on → null (open-ended, carries forward), off → the note's own month. A note is
// active for a month when valid_from <= month and (valid_to is null or valid_to >= month).
// Notes are never copied month to month; carrying over is just an open range, not new rows.
export const productNotesTable = pgTable(
  "product_notes",
  {
    id: serial("id").primaryKey(),
    businessId: integer("business_id")
      .notNull()
      .references(() => businessesTable.id),
    productId: integer("product_id")
      .notNull()
      .references(() => productsTable.id),
    noteTypeId: integer("note_type_id")
      .notNull()
      .references(() => noteTypesTable.id),
    text: text("text").notNull(),
    validFrom: varchar("valid_from", { length: 7 }).notNull(),
    validTo: varchar("valid_to", { length: 7 }),
    createdBy: integer("created_by")
      .notNull()
      .references(() => usersTable.id),
    ...timestamps,
  },
  (table) => [
    index("product_notes_business_id_idx").on(table.businessId),
    index("product_notes_product_id_idx").on(table.productId),
  ],
);
