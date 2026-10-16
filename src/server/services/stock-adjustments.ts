import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import { inventoryTable } from "@/db/schema/inventory";
import { locationsTable } from "@/db/schema/locations";
import { productsTable } from "@/db/schema/products";
import { stockAdjustmentsTable } from "@/db/schema/stock-adjustments";
import { usersTable } from "@/db/schema/users";

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
  reason: z.enum(["breakage", "shortage", "mis_sort", "count_error", "other"]),
  comment: z.string().trim().max(500).nullable().optional(),
  // Set only when this adjustment is one line of a posted stocktake (spec 11); null for a
  // manual single-item adjustment made from the stock page.
  stocktakeId: z.number().int().positive().nullable().optional(),
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
      comment: input.comment || null,
      adjustedBy: userId,
      stocktakeId: input.stocktakeId ?? null,
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

export interface StockAdjustmentRow {
  id: number;
  productName: string;
  sku: string | null;
  locationName: string;
  locationType: "warehouse" | "shop";
  oldQuantity: number;
  newQuantity: number;
  reason: "breakage" | "shortage" | "mis_sort" | "count_error" | "other";
  comment: string | null;
  adjustedByEmail: string;
  adjustedAt: Date;
}

/** Read-only correction history (spec mockup 20's "Історія коригувань") — manual adjustments only, newest first. */
export async function listStockAdjustments(
  businessId: number,
): Promise<StockAdjustmentRow[]> {
  return getDb()
    .select({
      id: stockAdjustmentsTable.id,
      productName: productsTable.name,
      sku: productsTable.sku,
      locationName: locationsTable.name,
      locationType: locationsTable.type,
      oldQuantity: stockAdjustmentsTable.oldQuantity,
      newQuantity: stockAdjustmentsTable.newQuantity,
      reason: stockAdjustmentsTable.reason,
      comment: stockAdjustmentsTable.comment,
      adjustedByEmail: usersTable.email,
      adjustedAt: stockAdjustmentsTable.adjustedAt,
    })
    .from(stockAdjustmentsTable)
    .innerJoin(
      productsTable,
      eq(productsTable.id, stockAdjustmentsTable.productId),
    )
    .innerJoin(
      locationsTable,
      eq(locationsTable.id, stockAdjustmentsTable.locationId),
    )
    .innerJoin(usersTable, eq(usersTable.id, stockAdjustmentsTable.adjustedBy))
    .where(eq(productsTable.businessId, businessId))
    .orderBy(desc(stockAdjustmentsTable.adjustedAt));
}
