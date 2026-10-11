import {
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  varchar,
} from "drizzle-orm/pg-core";
import { businessesTable } from "./businesses";
import { usersTable } from "./users";
import { timestamps } from "./_shared/timestamps";

// action_type and entity_type are free text, not a Postgres enum: the set of actions grows with
// every stage (sale, adjustment, transfer, return, price change, period reopen, ...), and an enum
// would need a migration each time. Callers validate the value against the spec section they
// implement (see src/server/audit.ts).
export const auditLogTable = pgTable(
  "audit_log",
  {
    id: serial("id").primaryKey(),
    businessId: integer("business_id")
      .notNull()
      .references(() => businessesTable.id),
    // Nullable: some entries are system-triggered (e.g. automatic month close), not a user action.
    userId: integer("user_id").references(() => usersTable.id),
    actionType: varchar("action_type", { length: 100 }).notNull(),
    entityType: varchar("entity_type", { length: 100 }).notNull(),
    entityId: integer("entity_id"),
    // No foreign key yet: products doesn't exist until stage 1.
    productId: integer("product_id"),
    oldValue: jsonb("old_value"),
    newValue: jsonb("new_value"),
    reason: text("reason"),
    ...timestamps,
  },
  (table) => [
    index("audit_log_business_id_idx").on(table.businessId),
    index("audit_log_user_id_idx").on(table.userId),
  ],
);
