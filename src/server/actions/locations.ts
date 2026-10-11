"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/db/client";
import { recordAuditEntry } from "@/server/audit";
import {
  createLocation,
  locationInputSchema,
  updateLocation,
} from "@/server/services/locations";
import { requireOwner } from "@/server/session";

export interface LocationFormState {
  error?: "invalid_input" | "not_found";
}

export async function createLocationAction(
  _prevState: LocationFormState,
  formData: FormData,
): Promise<LocationFormState> {
  const user = await requireOwner();

  const parsed = locationInputSchema.safeParse({
    name: formData.get("name"),
    type: formData.get("type"),
  });
  if (!parsed.success) {
    return { error: "invalid_input" };
  }

  const db = getDb();
  await db.transaction(async (tx) => {
    const location = await createLocation(tx, user.businessId, parsed.data);
    await recordAuditEntry(tx, {
      businessId: user.businessId,
      userId: user.id,
      actionType: "location.create",
      entityType: "location",
      entityId: location.id,
      newValue: parsed.data,
    });
  });

  revalidatePath("/[locale]/(app)/settings/locations", "page");
  return {};
}

export async function updateLocationAction(
  locationId: number,
  _prevState: LocationFormState,
  formData: FormData,
): Promise<LocationFormState> {
  const user = await requireOwner();

  const parsed = locationInputSchema.safeParse({
    name: formData.get("name"),
    type: formData.get("type"),
  });
  if (!parsed.success) {
    return { error: "invalid_input" };
  }

  const db = getDb();
  const result = await db.transaction(async (tx) => {
    const outcome = await updateLocation(
      tx,
      user.businessId,
      locationId,
      parsed.data,
    );
    if (outcome.ok) {
      await recordAuditEntry(tx, {
        businessId: user.businessId,
        userId: user.id,
        actionType: "location.update",
        entityType: "location",
        entityId: locationId,
        newValue: parsed.data,
      });
    }
    return outcome;
  });

  if (!result.ok) {
    return { error: result.reason };
  }

  revalidatePath("/[locale]/(app)/settings/locations", "page");
  return {};
}
