"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/db/client";
import { recordAuditEntry } from "@/server/audit";
import {
  businessSettingsInputSchema,
  updateBusinessSettings,
} from "@/server/services/business";
import { requireOwner } from "@/server/session";

export interface BusinessSettingsFormState {
  error?: "invalid_input";
  success?: boolean;
}

export async function updateBusinessSettingsAction(
  _prevState: BusinessSettingsFormState,
  formData: FormData,
): Promise<BusinessSettingsFormState> {
  const user = await requireOwner();

  // Only this section's own fields are present in formData (see the schema's .partial() note);
  // a field this form doesn't own must stay "not provided" (undefined), not a validation-failing
  // null, so the update only ever touches the fields the submitting form actually shows.
  const field = (key: string) => formData.get(key) ?? undefined;
  const parsed = businessSettingsInputSchema.safeParse({
    name: field("name"),
    description: field("description"),
    timezone: field("timezone"),
    currency: field("currency"),
    archivePeriodProducts: field("archivePeriodProducts"),
  });
  if (!parsed.success) {
    return { error: "invalid_input" };
  }

  const db = getDb();
  await db.transaction(async (tx) => {
    const business = await updateBusinessSettings(
      tx,
      user.businessId,
      parsed.data,
    );
    await recordAuditEntry(tx, {
      businessId: user.businessId,
      userId: user.id,
      actionType: "business.update_settings",
      entityType: "business",
      entityId: business.id,
      newValue: parsed.data,
    });
  });

  revalidatePath("/[locale]/(app)/settings", "page");
  return { success: true };
}
