"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/db/client";
import { recordAuditEntry } from "@/server/audit";
import {
  createNoteType,
  noteTypeInputSchema,
  updateNoteType,
} from "@/server/services/note-types";
import { requireOwner } from "@/server/session";

const SETTINGS_PAGE = "/[locale]/(app)/settings";

export interface NoteTypeFormState {
  error?: "invalid_input" | "not_found";
}

export async function createNoteTypeAction(
  _prevState: NoteTypeFormState,
  formData: FormData,
): Promise<NoteTypeFormState> {
  const user = await requireOwner();

  const parsed = noteTypeInputSchema.safeParse({
    name: formData.get("name"),
    color: formData.get("color"),
  });
  if (!parsed.success) {
    return { error: "invalid_input" };
  }

  const db = getDb();
  await db.transaction(async (tx) => {
    const noteType = await createNoteType(tx, user.businessId, parsed.data);
    await recordAuditEntry(tx, {
      businessId: user.businessId,
      userId: user.id,
      actionType: "note_type.create",
      entityType: "note_type",
      entityId: noteType.id,
      newValue: parsed.data,
    });
  });

  revalidatePath(SETTINGS_PAGE, "page");
  return {};
}

export async function updateNoteTypeAction(
  noteTypeId: number,
  _prevState: NoteTypeFormState,
  formData: FormData,
): Promise<NoteTypeFormState> {
  const user = await requireOwner();

  const parsed = noteTypeInputSchema.safeParse({
    name: formData.get("name"),
    color: formData.get("color"),
  });
  if (!parsed.success) {
    return { error: "invalid_input" };
  }

  const db = getDb();
  const result = await db.transaction(async (tx) => {
    const outcome = await updateNoteType(
      tx,
      user.businessId,
      noteTypeId,
      parsed.data,
    );
    if (outcome.ok) {
      await recordAuditEntry(tx, {
        businessId: user.businessId,
        userId: user.id,
        actionType: "note_type.update",
        entityType: "note_type",
        entityId: noteTypeId,
        newValue: parsed.data,
      });
    }
    return outcome;
  });

  if (!result.ok) return { error: result.reason };

  revalidatePath(SETTINGS_PAGE, "page");
  return {};
}
