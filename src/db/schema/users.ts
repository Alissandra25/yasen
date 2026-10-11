import {
  index,
  integer,
  pgEnum,
  pgTable,
  serial,
  varchar,
} from "drizzle-orm/pg-core";
import { businessesTable } from "./businesses";
import { timestamps } from "./_shared/timestamps";

// Only "owner" is reachable at launch (stage 0); "seller" is added when the owner can create
// accounts for staff, after the MVP (spec 9).
export const userRoleEnum = pgEnum("user_role", ["owner", "seller"]);
export const userThemeEnum = pgEnum("user_theme", ["light", "dark", "system"]);

export const usersTable = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    businessId: integer("business_id")
      .notNull()
      .references(() => businessesTable.id),
    email: varchar("email", { length: 255 }).notNull().unique(),
    passwordHash: varchar("password_hash", { length: 255 }).notNull(),
    role: userRoleEnum("role").notNull().default("owner"),
    theme: userThemeEnum("theme").notNull().default("system"),
    ...timestamps,
  },
  (table) => [index("users_business_id_idx").on(table.businessId)],
);
