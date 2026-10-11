import { pgTable, serial, text, varchar } from "drizzle-orm/pg-core";
import { timestamps } from "./_shared/timestamps";

// Minimal for stage 0: just enough for business_id foreign keys, the business time zone, and the
// name/description the home page shows. VAT, suppliers, archive periods and brand colours are
// added with the stages that need them. The logo lives in business_logo_assets, not here (spec
// 13.5): a business can have 0-4 logo rows (mark/lockup x light/dark), not one bytea column.
// description is not in spec 11's data model; see docs/spec/technical.md for the recorded decision.
export const businessesTable = pgTable("businesses", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  timezone: varchar("timezone", { length: 100 })
    .notNull()
    .default("Europe/Kyiv"),
  currency: varchar("currency", { length: 3 }).notNull().default("UAH"),
  ...timestamps,
});
