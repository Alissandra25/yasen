"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db/client";
import { recordAuditEntry } from "@/server/audit";
import {
  postStocktake,
  saveStocktakeCount,
  saveStocktakeCountSchema,
  startStocktake,
} from "@/server/services/stocktakes";
import { requireOwner } from "@/server/session";

const STOCK_PAGE = "/[locale]/(app)/stock";

/** Resumes the open draft for this location if there is one, otherwise starts a fresh one. */
export async function startStocktakeAction(
  locale: string,
  locationId: number,
): Promise<void> {
  const user = await requireOwner();

  const db = getDb();
  const stocktake = await db.transaction(async (tx) => {
    const created = await startStocktake(
      tx,
      user.businessId,
      user.id,
      locationId,
    );
    await recordAuditEntry(tx, {
      businessId: user.businessId,
      userId: user.id,
      actionType: "stocktake.start",
      entityType: "stocktake",
      entityId: created.id,
    });
    return created;
  });

  redirect(`/${locale}/stock/stocktake/${stocktake.id}`);
}

export interface SaveStocktakeCountState {
  error?: "invalid_input";
}

export async function saveStocktakeCountAction(
  stocktakeId: number,
  productId: number,
  countedQuantity: number,
  reason: "breakage" | "shortage" | "mis_sort" | "other" | null,
): Promise<SaveStocktakeCountState> {
  await requireOwner();

  const parsed = saveStocktakeCountSchema.safeParse({
    stocktakeId,
    productId,
    countedQuantity,
    reason,
  });
  if (!parsed.success) return { error: "invalid_input" };

  const db = getDb();
  await saveStocktakeCount(db, parsed.data);
  return {};
}

export type PostStocktakeActionResult =
  { ok: true; discrepancyCount: number } | { ok: false };

export async function postStocktakeAction(
  stocktakeId: number,
): Promise<PostStocktakeActionResult> {
  const user = await requireOwner();

  const db = getDb();
  const result = await db.transaction(async (tx) => {
    const outcome = await postStocktake(
      tx,
      user.id,
      user.businessId,
      stocktakeId,
    );
    if (outcome.ok) {
      await recordAuditEntry(tx, {
        businessId: user.businessId,
        userId: user.id,
        actionType: "stocktake.post",
        entityType: "stocktake",
        entityId: stocktakeId,
        newValue: { discrepancyCount: outcome.discrepancyCount },
      });
    }
    return outcome;
  });

  revalidatePath(STOCK_PAGE, "page");
  if (!result.ok) return { ok: false };
  return { ok: true, discrepancyCount: result.discrepancyCount };
}
