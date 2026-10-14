"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/db/client";
import { recordAuditEntry } from "@/server/audit";
import {
  createProductNote,
  deleteProductNote,
  productNoteInputSchema,
  updateProductNote,
} from "@/server/services/product-notes";
import { requireOwner } from "@/server/session";

const SALES_PAGE = "/[locale]/(app)/sales";

export interface ProductNoteFormState {
  error?: "invalid_input" | "not_found";
}

function parseNoteForm(formData: FormData) {
  return productNoteInputSchema.safeParse({
    productId: Number(formData.get("productId")),
    noteTypeId: Number(formData.get("noteTypeId")),
    text: formData.get("text"),
    carriesOver: formData.get("carriesOver") === "on",
    validFrom: formData.get("validFrom"),
  });
}

export async function createProductNoteAction(
  _prevState: ProductNoteFormState,
  formData: FormData,
): Promise<ProductNoteFormState> {
  const user = await requireOwner();

  const parsed = parseNoteForm(formData);
  if (!parsed.success) return { error: "invalid_input" };

  const db = getDb();
  await db.transaction(async (tx) => {
    const note = await createProductNote(
      tx,
      user.businessId,
      user.id,
      parsed.data,
    );
    await recordAuditEntry(tx, {
      businessId: user.businessId,
      userId: user.id,
      actionType: "product_note.create",
      entityType: "product_note",
      entityId: note.id,
      productId: parsed.data.productId,
      newValue: parsed.data,
    });
  });

  revalidatePath(SALES_PAGE, "page");
  return {};
}

export async function updateProductNoteAction(
  noteId: number,
  _prevState: ProductNoteFormState,
  formData: FormData,
): Promise<ProductNoteFormState> {
  const user = await requireOwner();

  const parsed = parseNoteForm(formData);
  if (!parsed.success) return { error: "invalid_input" };

  const db = getDb();
  const result = await db.transaction(async (tx) => {
    const outcome = await updateProductNote(
      tx,
      user.businessId,
      noteId,
      parsed.data,
    );
    if (outcome.ok) {
      await recordAuditEntry(tx, {
        businessId: user.businessId,
        userId: user.id,
        actionType: "product_note.update",
        entityType: "product_note",
        entityId: noteId,
        productId: parsed.data.productId,
        newValue: parsed.data,
      });
    }
    return outcome;
  });

  if (!result.ok) return { error: result.reason };

  revalidatePath(SALES_PAGE, "page");
  return {};
}

export async function deleteProductNoteAction(
  noteId: number,
  productId: number,
): Promise<void> {
  const user = await requireOwner();

  const db = getDb();
  await db.transaction(async (tx) => {
    const outcome = await deleteProductNote(tx, user.businessId, noteId);
    if (outcome.ok) {
      await recordAuditEntry(tx, {
        businessId: user.businessId,
        userId: user.id,
        actionType: "product_note.delete",
        entityType: "product_note",
        entityId: noteId,
        productId,
        oldValue: { text: outcome.note.text },
      });
    }
  });

  revalidatePath(SALES_PAGE, "page");
}
