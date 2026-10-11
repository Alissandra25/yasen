// One-off dev seed: inserts the single business row if none exists yet (spec 12.4: one
// installation per business), and backfills description if an older seed left it unset.
// Safe to re-run.
import "dotenv/config";
import { eq } from "drizzle-orm";
import { getDb } from "../src/db/client";
import { businessesTable } from "../src/db/schema/businesses";

const db = getDb();
// The logo lockup's tagline (spec 13.5), as a description rather than the logo's all-caps wordmark.
const DESCRIPTION = "Господарські товари";

const [existing] = await db.select().from(businessesTable).limit(1);

if (!existing) {
  const [business] = await db
    .insert(businessesTable)
    .values({ name: "Ясен", description: DESCRIPTION })
    .returning();
  console.log("Seeded business:", business.name);
} else if (!existing.description) {
  await db
    .update(businessesTable)
    .set({ description: DESCRIPTION })
    .where(eq(businessesTable.id, existing.id));
  console.log("Backfilled description for:", existing.name);
} else {
  console.log("Business already seeded:", existing.name);
}
