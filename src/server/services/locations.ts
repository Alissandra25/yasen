import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import { locationsTable } from "@/db/schema/locations";

type WritableDbOrTx = Pick<
  ReturnType<typeof getDb>,
  "select" | "insert" | "update"
>;

export const locationInputSchema = z.object({
  name: z.string().trim().min(1).max(255),
  type: z.enum(["shop", "warehouse"]),
});

export type LocationInput = z.infer<typeof locationInputSchema>;

// No db/tx parameter, unlike the writes below: this is a standalone read called directly from a
// page (like getCurrentBusiness), never from inside another transaction.
export async function listLocations(businessId: number) {
  return getDb()
    .select()
    .from(locationsTable)
    .where(eq(locationsTable.businessId, businessId))
    .orderBy(asc(locationsTable.name));
}

export async function createLocation(
  db: WritableDbOrTx,
  businessId: number,
  input: LocationInput,
) {
  const [location] = await db
    .insert(locationsTable)
    .values({ businessId, name: input.name, type: input.type })
    .returning();
  return location;
}

export type UpdateLocationResult =
  | { ok: true; location: typeof locationsTable.$inferSelect }
  | { ok: false; reason: "not_found" };

export async function updateLocation(
  db: WritableDbOrTx,
  businessId: number,
  locationId: number,
  input: LocationInput,
): Promise<UpdateLocationResult> {
  const [location] = await db
    .update(locationsTable)
    .set({ name: input.name, type: input.type })
    .where(
      and(
        eq(locationsTable.id, locationId),
        eq(locationsTable.businessId, businessId),
      ),
    )
    .returning();

  if (!location) {
    return { ok: false, reason: "not_found" };
  }
  return { ok: true, location };
}
