import {
  boolean,
  index,
  integer,
  pgTable,
  serial,
  varchar,
} from "drizzle-orm/pg-core";
import { businessesTable } from "./businesses";
import { categoriesTable } from "./categories";
import { suppliersTable } from "./suppliers";
import { timestamps } from "./_shared/timestamps";

// category_id is the product's most specific category (spec 11): a subcategory if it has one,
// otherwise a top-level category — either way just a row in the categories table, required.
// default_supplier_id defaults to the supplier of the latest receipt once goods receipts exist
// (milestone 6); for now it's just a manually-set, optional main supplier.
// needs_review: set when a product is quick-created from a receipt with minimal info (milestone
// 6); false for a deliberate full creation through this milestone's own UI.
// velocity_threshold_pct is deliberately not here yet: it only matters to restock_rules
// (stage 3), unlike min_stock, which goods receipts (still stage 1) already set.
export const productsTable = pgTable(
  "products",
  {
    id: serial("id").primaryKey(),
    businessId: integer("business_id")
      .notNull()
      .references(() => businessesTable.id),
    name: varchar("name", { length: 255 }).notNull(),
    sku: varchar("sku", { length: 100 }),
    categoryId: integer("category_id")
      .notNull()
      .references(() => categoriesTable.id),
    minStock: integer("min_stock").notNull().default(0),
    defaultSupplierId: integer("default_supplier_id").references(
      () => suppliersTable.id,
    ),
    needsReview: boolean("needs_review").notNull().default(false),
    archived: boolean("archived").notNull().default(false),
    ...timestamps,
  },
  (table) => [
    index("products_business_id_idx").on(table.businessId),
    index("products_category_id_idx").on(table.categoryId),
    index("products_default_supplier_id_idx").on(table.defaultSupplierId),
  ],
);
