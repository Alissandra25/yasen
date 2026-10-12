import {
  date,
  integer,
  pgTable,
  serial,
  text,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { businessesTable } from "./businesses";
import { locationsTable } from "./locations";
import { usersTable } from "./users";
import { timestamps } from "./_shared/timestamps";

// Spec 3.8: "a single adjustment field per day", not an append-only ledger like sales — one row
// per (location, date), edited in place. amount is usually negative (how much lower actual
// revenue was than calculated, due to discounts given with no per-sale record of them).
export const cashAdjustmentsTable = pgTable(
  "cash_adjustments",
  {
    id: serial("id").primaryKey(),
    businessId: integer("business_id")
      .notNull()
      .references(() => businessesTable.id),
    locationId: integer("location_id")
      .notNull()
      .references(() => locationsTable.id),
    date: date("date", { mode: "string" }).notNull(),
    amount: integer("amount").notNull(),
    note: text("note"),
    createdBy: integer("created_by")
      .notNull()
      .references(() => usersTable.id),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("cash_adjustments_location_date_idx").on(
      table.locationId,
      table.date,
    ),
  ],
);
