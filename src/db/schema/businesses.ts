import { bytea, pgTable, serial, text, varchar } from "drizzle-orm/pg-core";
import { timestamps } from "./_shared/timestamps";

// Minimal for stage 0: just enough for business_id foreign keys, the business time zone, and the
// name/description/logo the home page shows. VAT, suppliers, archive periods and brand colours
// are added with the stages that need them (spec 13.5: the logo itself is served from here,
// bytea, no separate file storage, max ~1MB, PNG/JPG/WebP only — upload UI is stage 4).
// description is not in spec 11's data model; see docs/spec/technical.md for the recorded decision.
export const businessesTable = pgTable("businesses", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  timezone: varchar("timezone", { length: 100 })
    .notNull()
    .default("Europe/Kyiv"),
  currency: varchar("currency", { length: 3 }).notNull().default("UAH"),
  logo: bytea("logo"),
  logoMimeType: varchar("logo_mime_type", { length: 100 }),
  ...timestamps,
});
