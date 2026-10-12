import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import { cashAdjustmentsTable } from "@/db/schema/cash-adjustments";
import { productsTable } from "@/db/schema/products";
import { salesTable } from "@/db/schema/sales";
import { dateOnlySchema } from "@/lib/dates";

type WritableDbOrTx = Pick<
  ReturnType<typeof getDb>,
  "select" | "insert" | "update"
>;

export type CashAdjustment = typeof cashAdjustmentsTable.$inferSelect;

export const cashAdjustmentInputSchema = z.object({
  locationId: z.number().int().positive(),
  date: dateOnlySchema,
  // A plain magnitude ("how much lower actual revenue was", spec 3.8), always >= 0 — the
  // service stores it negated, since the UI never collects a positive adjustment.
  discountAmount: z.number().int().nonnegative(),
  note: z.string().trim().max(500).nullable(),
});

export type CashAdjustmentInput = z.infer<typeof cashAdjustmentInputSchema>;

/** One row per (location, date) — editing a day's adjustment upserts in place, not a new row. */
export async function setDailyCashAdjustment(
  db: WritableDbOrTx,
  businessId: number,
  userId: number,
  input: CashAdjustmentInput,
): Promise<CashAdjustment> {
  const [adjustment] = await db
    .insert(cashAdjustmentsTable)
    .values({
      businessId,
      locationId: input.locationId,
      date: input.date,
      amount: -input.discountAmount,
      note: input.note,
      createdBy: userId,
    })
    .onConflictDoUpdate({
      target: [cashAdjustmentsTable.locationId, cashAdjustmentsTable.date],
      set: {
        amount: -input.discountAmount,
        note: input.note,
        createdBy: userId,
      },
    })
    .returning();
  return adjustment;
}

export interface DailyCashSummary {
  cash: number;
  card: number;
  /** Revenue from sales with no payment method set — the cash/card split toggle was off. */
  unspecified: number;
  grossTotal: number;
  adjustmentAmount: number;
  adjustmentNote: string | null;
  netTotal: number;
}

/**
 * Cash reconciliation for one day at one location (spec 3.8): revenue per payment method is a
 * sum of quantity * unit_price over every sales row for that day — correct even though sales
 * are append-only signed deltas, since a correction to an existing cell keeps the same
 * historical unit_price as the entry it corrects.
 */
export async function getDailyCashSummary(
  businessId: number,
  locationId: number,
  date: string,
): Promise<DailyCashSummary> {
  const db = getDb();

  const rows = await db
    .select({
      quantity: salesTable.quantity,
      unitPrice: salesTable.unitPrice,
      paymentMethod: salesTable.paymentMethod,
    })
    .from(salesTable)
    .innerJoin(productsTable, eq(productsTable.id, salesTable.productId))
    .where(
      and(
        eq(productsTable.businessId, businessId),
        eq(salesTable.locationId, locationId),
        eq(salesTable.saleDate, date),
      ),
    );

  let cash = 0;
  let card = 0;
  let unspecified = 0;
  for (const row of rows) {
    const revenue = row.quantity * row.unitPrice;
    if (row.paymentMethod === "cash") cash += revenue;
    else if (row.paymentMethod === "card") card += revenue;
    else unspecified += revenue;
  }
  const grossTotal = cash + card + unspecified;

  const [adjustment] = await db
    .select({
      amount: cashAdjustmentsTable.amount,
      note: cashAdjustmentsTable.note,
    })
    .from(cashAdjustmentsTable)
    .where(
      and(
        eq(cashAdjustmentsTable.businessId, businessId),
        eq(cashAdjustmentsTable.locationId, locationId),
        eq(cashAdjustmentsTable.date, date),
      ),
    );

  const adjustmentAmount = adjustment?.amount ?? 0;

  return {
    cash,
    card,
    unspecified,
    grossTotal,
    adjustmentAmount,
    adjustmentNote: adjustment?.note ?? null,
    netTotal: grossTotal + adjustmentAmount,
  };
}
