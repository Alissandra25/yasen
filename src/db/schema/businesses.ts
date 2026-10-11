import { pgTable, serial, varchar } from "drizzle-orm/pg-core";
import { timestamps } from "./_shared/timestamps";

// Minimal for stage 0: just enough for business_id foreign keys and the business time zone.
// VAT, suppliers, archive periods, branding and the logo are added with the stages that need them.
export const businessesTable = pgTable("businesses", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  timezone: varchar("timezone", { length: 100 })
    .notNull()
    .default("Europe/Kyiv"),
  currency: varchar("currency", { length: 3 }).notNull().default("UAH"),
  ...timestamps,
});
