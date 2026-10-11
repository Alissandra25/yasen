import { getDb } from "@/db/client";
import { businessesTable } from "@/db/schema/businesses";

// One installation per business at launch (spec 12.4), so there is exactly one row.
export async function getCurrentBusiness() {
  const [business] = await getDb().select().from(businessesTable).limit(1);
  return business;
}
