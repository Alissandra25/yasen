import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import { businessesTable } from "@/db/schema/businesses";

// One installation per business at launch (spec 12.4), so there is exactly one row.
export async function getCurrentBusiness() {
  const [business] = await getDb().select().from(businessesTable).limit(1);
  return business;
}

// Only the columns that already exist and have no UI yet (spec: name, description, timezone,
// currency, archive_period_products). VAT, supplier tracking, brand colours, logo and the other
// Settings mockup fields are deferred to the stage that adds their own columns — see this
// table's schema comment in src/db/schema/businesses.ts.
// .partial(): each settings section (Магазин і вигляд, Облік і гроші, Докупівля й архів) submits
// its own form against this one business row, so only the fields that section owns are present.
export const businessSettingsInputSchema = z
  .object({
    name: z.string().trim().min(1).max(255),
    description: z
      .string()
      .trim()
      .max(255)
      .transform((value) => value || null)
      .nullable(),
    timezone: z.string().trim().min(1).max(100),
    currency: z.string().trim().length(3),
    archivePeriodProducts: z.coerce.number().int().min(1).max(36),
  })
  .partial();

export type BusinessSettingsInput = z.infer<typeof businessSettingsInputSchema>;

type WritableDbOrTx = Pick<ReturnType<typeof getDb>, "update">;

export async function updateBusinessSettings(
  db: WritableDbOrTx,
  businessId: number,
  input: BusinessSettingsInput,
) {
  const [business] = await db
    .update(businessesTable)
    .set(input)
    .where(eq(businessesTable.id, businessId))
    .returning();
  return business;
}
