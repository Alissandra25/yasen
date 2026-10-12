import {
  boolean,
  index,
  integer,
  pgTable,
  serial,
  text,
  varchar,
} from "drizzle-orm/pg-core";
import { businessesTable } from "./businesses";
import { timestamps } from "./_shared/timestamps";

// is_system: the hidden supplier used when supplier tracking is off (spec 3.11, a stage-4
// toggle) — not editable/deletable, never shown in the reference list. Not surfaced anywhere yet,
// but the row exists from stage 1 so the model is ready when that toggle ships.
// needs_review: set on the "typed a bare name during a receipt" quick-create path (spec 3.1),
// cleared when the owner opens and confirms the record.
export const suppliersTable = pgTable(
  "suppliers",
  {
    id: serial("id").primaryKey(),
    businessId: integer("business_id")
      .notNull()
      .references(() => businessesTable.id),
    name: varchar("name", { length: 255 }).notNull(),
    contacts: text("contacts"),
    note: text("note"),
    isSystem: boolean("is_system").notNull().default(false),
    needsReview: boolean("needs_review").notNull().default(false),
    archived: boolean("archived").notNull().default(false),
    ...timestamps,
  },
  (table) => [index("suppliers_business_id_idx").on(table.businessId)],
);
