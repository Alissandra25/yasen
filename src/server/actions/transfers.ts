"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/db/client";
import { recordAuditEntry } from "@/server/audit";
import {
  postTransfer,
  postTransferInputSchema,
} from "@/server/services/transfers";
import { requireOwner } from "@/server/session";

const STOCK_PAGE = "/[locale]/(app)/stock";
const TRANSFERS_PAGE = "/[locale]/(app)/transfers";

export interface PostTransferActionResult {
  ok: boolean;
  error?: "invalid_input" | "insufficient_stock";
  productId?: number;
  available?: number;
  transferId?: number;
}

export async function postTransferAction(
  input: unknown,
): Promise<PostTransferActionResult> {
  const user = await requireOwner();

  const parsed = postTransferInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };

  const db = getDb();
  const result = await db.transaction(async (tx) => {
    const outcome = await postTransfer(
      tx,
      user.businessId,
      user.id,
      parsed.data,
    );
    if (outcome.ok) {
      await recordAuditEntry(tx, {
        businessId: user.businessId,
        userId: user.id,
        actionType: "transfer.post",
        entityType: "transfer",
        entityId: outcome.transfer.id,
        newValue: {
          fromLocationId: parsed.data.fromLocationId,
          toLocationId: parsed.data.toLocationId,
          lineCount: parsed.data.lines.length,
        },
      });
    }
    return outcome;
  });

  if (!result.ok) {
    return {
      ok: false,
      error: "insufficient_stock",
      productId: result.productId,
      available: result.available,
    };
  }

  revalidatePath(STOCK_PAGE, "page");
  revalidatePath(TRANSFERS_PAGE, "page");
  return { ok: true, transferId: result.transfer.id };
}
