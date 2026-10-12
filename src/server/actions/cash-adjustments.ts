"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db/client";
import { dateOnlySchema } from "@/lib/dates";
import { moneyInputSchema, parseMoney } from "@/lib/money";
import { recordAuditEntry } from "@/server/audit";
import { setDailyCashAdjustment } from "@/server/services/cash-adjustments";
import { requireOwner } from "@/server/session";

const SALES_PAGE = "/[locale]/(app)/sales";

const setCashAdjustmentActionInputSchema = z.object({
  locationId: z.number().int().positive(),
  date: dateOnlySchema,
  // Empty string means "no discount today" (0), not invalid input.
  discountAmountRaw: z.string(),
  note: z.string().trim().max(500).nullable(),
});

export type SetCashAdjustmentActionInput = z.input<
  typeof setCashAdjustmentActionInputSchema
>;

export interface SetCashAdjustmentActionResult {
  ok: boolean;
  error?: "invalid_input";
}

export async function setCashAdjustmentAction(
  input: SetCashAdjustmentActionInput,
): Promise<SetCashAdjustmentActionResult> {
  const user = await requireOwner();

  const parsed = setCashAdjustmentActionInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };

  const raw = parsed.data.discountAmountRaw.trim();
  if (raw !== "" && !moneyInputSchema.safeParse(raw).success) {
    return { ok: false, error: "invalid_input" };
  }
  const discountAmount = raw === "" ? 0 : parseMoney(raw);

  const db = getDb();
  await db.transaction(async (tx) => {
    const adjustment = await setDailyCashAdjustment(
      tx,
      user.businessId,
      user.id,
      {
        locationId: parsed.data.locationId,
        date: parsed.data.date,
        discountAmount,
        note: parsed.data.note,
      },
    );
    await recordAuditEntry(tx, {
      businessId: user.businessId,
      userId: user.id,
      actionType: "cash_adjustment.set",
      entityType: "cash_adjustment",
      entityId: adjustment.id,
      newValue: { discountAmount, note: parsed.data.note },
    });
  });

  revalidatePath(SALES_PAGE, "page");
  return { ok: true };
}
