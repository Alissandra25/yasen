// One-off dev seed: inserts the single business row if none exists yet (spec 12.4: one
// installation per business). Safe to re-run; it's a no-op once a business exists.
import "dotenv/config";
import { getDb } from "../src/db/client";
import { businessesTable } from "../src/db/schema/businesses";

const db = getDb();
const existing = await db.select().from(businessesTable).limit(1);

if (existing.length > 0) {
  console.log("Business already seeded:", existing[0].name);
} else {
  const [business] = await db.insert(businessesTable).values({ name: "Ясен" }).returning();
  console.log("Seeded business:", business.name);
}
