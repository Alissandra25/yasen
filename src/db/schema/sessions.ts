import {
  index,
  integer,
  pgTable,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { timestamps } from "./_shared/timestamps";

// Spec 9: "the server holds the session, the browser holds the key in a cookie." The id is an
// opaque random token (not a signed/stateless JWT), so a session can be revoked server-side on
// logout or password change by deleting its row.
export const sessionsTable = pgTable(
  "sessions",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id),
    // Lifetime 1-2 weeks, extended on activity (spec 9): touched forward on each authenticated
    // request rather than fixed at creation.
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ...timestamps,
  },
  (table) => [index("sessions_user_id_idx").on(table.userId)],
);
