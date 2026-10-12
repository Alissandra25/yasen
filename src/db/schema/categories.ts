import type { AnyPgColumn } from "drizzle-orm/pg-core";
import {
  boolean,
  index,
  integer,
  pgTable,
  serial,
  varchar,
} from "drizzle-orm/pg-core";
import { businessesTable } from "./businesses";
import { timestamps } from "./_shared/timestamps";

// A subcategory is just a category with a parent (spec 3.1) — same table, not a separate one.
// sort_order (not "order", a reserved SQL word) is scoped within the same parent: top-level
// categories are ordered among themselves, and each category's subcategories are ordered among
// themselves, independently.
export const categoriesTable = pgTable(
  "categories",
  {
    id: serial("id").primaryKey(),
    businessId: integer("business_id")
      .notNull()
      .references(() => businessesTable.id),
    name: varchar("name", { length: 255 }).notNull(),
    parentId: integer("parent_id").references(
      (): AnyPgColumn => categoriesTable.id,
    ),
    sortOrder: integer("sort_order").notNull().default(0),
    archived: boolean("archived").notNull().default(false),
    ...timestamps,
  },
  (table) => [
    index("categories_business_id_idx").on(table.businessId),
    index("categories_parent_id_idx").on(table.parentId),
  ],
);
