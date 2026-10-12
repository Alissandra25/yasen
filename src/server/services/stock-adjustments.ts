import { and, eq } from "drizzle-orm";
import { z } from "zod";
import type { getDb } from "@/db/client";
import { inventoryTable } from "@/db/schema/inventory";
import { stockAdjustmentsTable } from "@/db/schema/stock-adjustments";

type WritableDbOrTx = Pick<
  ReturnType<typeof getDb>,
  "select" | "insert" | "update"
>;

export type StockAdjustment = typeof stockAdjustmentsTable.$inferSelect;

export const stockAdjustmentInputSchema = z.object({
  productId: z.number().int().positive(),
  locationId: z.number().int().positive(),
  // Aligns stock to the actual counted/known value (spec 4.1) — any integer, since stock is
  // already allowed to be negative elsewhere (spec 4.1) and a correction may target that too.
  newQuantity: z.number().int(),
  reason: z.enum(["breakage", "shortage", "mis_sort", "other"]),
});

export type StockAdjustmentInput = z.infer<typeof stockAdjustmentInputSchema>;

export type AdjustStockResult =
  | { ok: true; adjustment: StockAdjustment }
  | { ok: false; reason: "not_found" };

/**
 * Records the old -> new quantity with a reason (spec 4.1) and aligns inventory to the new
 * value, in that order so the audit trail always has the true prior quantity even if the
 * inventory row is somehow missing (defensive — createProduct seeds one for every location).
 */
export async function adjustStock(
  db: WritableDbOrTx,
  userId: number,
  input: StockAdjustmentInput,
): Promise<AdjustStockResult> {
  const [inventoryRow] = await db
    .select({ quantity: inventoryTable.quantity })
    .from(inventoryTable)
    .where(
      and(
        eq(inventoryTable.productId, input.productId),
        eq(inventoryTable.locationId, input.locationId),
      ),
    );
  if (!inventoryRow) return { ok: false, reason: "not_found" };

  const [adjustment] = await db
    .insert(stockAdjustmentsTable)
    .values({
      productId: input.productId,
      locationId: input.locationId,
      oldQuantity: inventoryRow.quantity,
      newQuantity: input.newQuantity,
      reason: input.reason,
      adjustedBy: userId,
    })
    .returning();

  await db
    .update(inventoryTable)
    .set({ quantity: input.newQuantity, lastMovementAt: new Date() })
    .where(
      and(
        eq(inventoryTable.productId, input.productId),
        eq(inventoryTable.locationId, input.locationId),
      ),
    );

  return { ok: true, adjustment };
}
