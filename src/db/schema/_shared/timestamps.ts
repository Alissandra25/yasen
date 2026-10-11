import { timestamp } from "drizzle-orm/pg-core";

// Every table spreads this. created_at is set by the database; updated_at is maintained by
// Drizzle's $onUpdate, so direct SQL writes (data migrations, manual fixes) must set it themselves.
export const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
};
