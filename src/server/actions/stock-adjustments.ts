"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/db/client";
import { recordAuditEntry } from "@/server/audit";
import {
  adjustStock,
  stockAdjustmentInputSchema,
} from "@/server/services/stock-adjustments";
import { requireOwner } from "@/server/session";

const STOCK_PAGE = "/[locale]/(app)/stock";

export interface StockAdjustmentFormState {
  error?: "invalid_input" | "not_found";
}

/**
 * Permission check is requireOwner() for now — spec 4.1 frames this as "a permission tied to a
 * role, not hard-wired to the owner", but only the owner role is reachable at launch (spec 2),
 * so this is the correct check today and the one place to widen later.
 */
export async function adjustStockAction(
  _prevState: StockAdjustmentFormState,
  formData: FormData,
): Promise<StockAdjustmentFormState> {
  const user = await requireOwner();

  const parsed = stockAdjustmentInputSchema.safeParse({
    productId: Number(formData.get("productId")),
    locationId: Number(formData.get("locationId")),
    newQuantity: Number(formData.get("newQuantity")),
    reason: formData.get("reason"),
    comment: formData.get("comment") || null,
  });
  if (!parsed.success) return { error: "invalid_input" };

  const db = getDb();
  const result = await db.transaction(async (tx) => {
    const outcome = await adjustStock(tx, user.id, parsed.data);
    if (outcome.ok) {
      await recordAuditEntry(tx, {
        businessId: user.businessId,
        userId: user.id,
        actionType: "stock_adjustment.create",
        entityType: "stock_adjustment",
        entityId: outcome.adjustment.id,
        productId: parsed.data.productId,
        oldValue: { quantity: outcome.adjustment.oldQuantity },
        newValue: { quantity: outcome.adjustment.newQuantity },
        reason: parsed.data.reason,
      });
    }
    return outcome;
  });

  if (!result.ok) return { error: result.reason };

  revalidatePath(STOCK_PAGE, "page");
  return {};
}
