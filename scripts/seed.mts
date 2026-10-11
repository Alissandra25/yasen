// One-off dev seed: inserts the single business row if none exists yet (spec 12.4: one
// installation per business), and backfills description if an older seed left it unset.
// Safe to re-run.
import "dotenv/config";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { businessesTable } from "@/db/schema/businesses";
import { usersTable } from "@/db/schema/users";
import { hashPassword } from "@/server/services/auth";

const db = getDb();
// The logo lockup's tagline (spec 13.5), as a description rather than the logo's all-caps wordmark.
const DESCRIPTION = "Господарські товари";

const [existing] = await db.select().from(businessesTable).limit(1);

let businessId: number;
if (!existing) {
  const [business] = await db
    .insert(businessesTable)
    .values({ name: "Ясен", description: DESCRIPTION })
    .returning();
  console.log("Seeded business:", business.name);
  businessId = business.id;
} else if (!existing.description) {
  await db
    .update(businessesTable)
    .set({ description: DESCRIPTION })
    .where(eq(businessesTable.id, existing.id));
  console.log("Backfilled description for:", existing.name);
  businessId = existing.id;
} else {
  console.log("Business already seeded:", existing.name);
  businessId = existing.id;
}

// Owner credentials never live in this file: read from .env (OWNER_SEED_EMAIL /
// OWNER_SEED_PASSWORD, not committed) so no password ends up in git history.
const ownerEmail = process.env.OWNER_SEED_EMAIL;
const ownerPassword = process.env.OWNER_SEED_PASSWORD;

if (!ownerEmail || !ownerPassword) {
  console.log(
    "Skipped owner user: set OWNER_SEED_EMAIL and OWNER_SEED_PASSWORD in .env to seed one.",
  );
} else {
  const [existingOwner] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, ownerEmail))
    .limit(1);

  if (!existingOwner) {
    const passwordHash = await hashPassword(ownerPassword);
    await db
      .insert(usersTable)
      .values({ businessId, email: ownerEmail, passwordHash, role: "owner" });
    console.log("Seeded owner user:", ownerEmail);
  } else {
    console.log("Owner user already seeded:", ownerEmail);
  }
}
