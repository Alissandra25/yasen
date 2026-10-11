import {
  bytea,
  index,
  integer,
  pgEnum,
  pgTable,
  serial,
  unique,
  varchar,
} from "drizzle-orm/pg-core";
import { businessesTable } from "./businesses";
import { timestamps } from "./_shared/timestamps";

// mark = square icon only (favicon/app-icon generation); lockup = mark + wordmark + tagline
// (header, printed documents). A business needs neither, either, or all four rows: the resolver
// in src/server/services/logo.ts falls back from lockup to a cropped mark, and from dark to
// light with a backing plate, so a single uploaded image (the stage-4 case) works the same way
// as a prepared four-asset set (this shop's case) through the same code path.
export const logoSlotEnum = pgEnum("logo_slot", ["mark", "lockup"]);
export const logoThemeEnum = pgEnum("logo_theme", ["light", "dark"]);

export const businessLogoAssetsTable = pgTable(
  "business_logo_assets",
  {
    id: serial("id").primaryKey(),
    businessId: integer("business_id")
      .notNull()
      .references(() => businessesTable.id),
    slot: logoSlotEnum("slot").notNull(),
    theme: logoThemeEnum("theme").notNull(),
    image: bytea("image").notNull(),
    mimeType: varchar("mime_type", { length: 100 }).notNull(),
    ...timestamps,
  },
  (table) => [
    index("business_logo_assets_business_id_idx").on(table.businessId),
    unique("business_logo_assets_business_slot_theme_key").on(
      table.businessId,
      table.slot,
      table.theme,
    ),
  ],
);
