"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db/client";
import { recordAuditEntry } from "@/server/audit";
import { recordSale, recordSaleInputSchema } from "@/server/services/sales";
import { requireOwner } from "@/server/session";

const MATRIX_PAGE = "/[locale]/(app)/sales";

const recordSalesActionInputSchema = z.array(recordSaleInputSchema).min(1);

export type RecordSalesActionInput = z.input<
  typeof recordSalesActionInputSchema
>;

export interface RecordSalesActionResult {
  ok: boolean;
  error?: "invalid_input" | "no_price";
  recordedCount?: number;
}

class NoPriceError extends Error {
  constructor(readonly productId: number) {
    super("no_price");
  }
}

/**
 * Saves a batch of matrix cell edits (each a signed quantity delta, spec 3.6's append-only
 * model) in one transaction: if any entry has no usable historical price, the whole batch is
 * rolled back rather than partially saved, so the owner's "save" action is all-or-nothing.
 * One audit entry summarises the batch (count), not one per row — the matrix is edited far
 * more often than other features, and a per-cell entry would flood the log for no benefit the
 * batch summary doesn't already give.
 */
export async function recordSalesAction(
  entries: RecordSalesActionInput,
): Promise<RecordSalesActionResult> {
  const user = await requireOwner();

  const parsed = recordSalesActionInputSchema.safeParse(entries);
  if (!parsed.success) return { ok: false, error: "invalid_input" };

  const db = getDb();
  try {
    const recordedCount = await db.transaction(async (tx) => {
      let count = 0;
      for (const entry of parsed.data) {
        const result = await recordSale(tx, user.id, entry);
        if (!result.ok) throw new NoPriceError(entry.productId);
        if (result.recorded) count++;
      }
      if (count > 0) {
        await recordAuditEntry(tx, {
          businessId: user.businessId,
          userId: user.id,
          actionType: "sale.record_batch",
          entityType: "sale",
          newValue: { recordedCount: count },
        });
      }
      return count;
    });

    revalidatePath(MATRIX_PAGE, "page");
    return { ok: true, recordedCount };
  } catch (error) {
    if (error instanceof NoPriceError) return { ok: false, error: "no_price" };
    throw error;
  }
}
