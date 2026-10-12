import { integer, pgTable, serial, text, varchar } from "drizzle-orm/pg-core";
import { timestamps } from "./_shared/timestamps";

// Minimal for stage 0: just enough for business_id foreign keys, the business time zone, and the
// name/description the home page shows. VAT, suppliers_enabled, archive_period_suppliers and
// brand colours stay deferred to the stages that need them. archive_period_products lands now
// (milestone 4) because products' archive-candidate query needs it this milestone, unlike the
// others. The logo lives in business_logo_assets, not here (spec 13.5): a business can have 0-4
// logo rows (mark/lockup x light/dark), not one bytea column.
// description is not in spec 11's data model; see docs/spec/technical.md for the recorded decision.
export const businessesTable = pgTable("businesses", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  timezone: varchar("timezone", { length: 100 })
    .notNull()
    .default("Europe/Kyiv"),
  currency: varchar("currency", { length: 3 }).notNull().default("UAH"),
  // Months of zero stock + no movement before a product is an archive candidate (spec 3.1).
  archivePeriodProducts: integer("archive_period_products")
    .notNull()
    .default(1),
  ...timestamps,
});
