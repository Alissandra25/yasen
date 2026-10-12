"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db/client";
import { recordAuditEntry } from "@/server/audit";
import {
  archiveSupplier,
  confirmSuppliersReviewed,
  createSupplier,
  supplierInputSchema,
  updateSupplier,
} from "@/server/services/suppliers";
import { requireOwner } from "@/server/session";

const SUPPLIERS_PAGE = "/[locale]/(app)/settings/suppliers";

export interface SupplierFormState {
  error?: "invalid_input" | "not_found";
}

export async function createSupplierAction(
  _prevState: SupplierFormState,
  formData: FormData,
): Promise<SupplierFormState> {
  const user = await requireOwner();

  const parsed = supplierInputSchema.safeParse({
    name: formData.get("name"),
    contacts: formData.get("contacts"),
    note: formData.get("note"),
  });
  if (!parsed.success) {
    return { error: "invalid_input" };
  }

  const db = getDb();
  await db.transaction(async (tx) => {
    const supplier = await createSupplier(tx, user.businessId, parsed.data);
    await recordAuditEntry(tx, {
      businessId: user.businessId,
      userId: user.id,
      actionType: "supplier.create",
      entityType: "supplier",
      entityId: supplier.id,
      newValue: parsed.data,
    });
  });

  revalidatePath(SUPPLIERS_PAGE, "page");
  return {};
}

export async function updateSupplierAction(
  supplierId: number,
  _prevState: SupplierFormState,
  formData: FormData,
): Promise<SupplierFormState> {
  const user = await requireOwner();

  const parsed = supplierInputSchema.safeParse({
    name: formData.get("name"),
    contacts: formData.get("contacts"),
    note: formData.get("note"),
  });
  if (!parsed.success) {
    return { error: "invalid_input" };
  }

  const db = getDb();
  const result = await db.transaction(async (tx) => {
    const outcome = await updateSupplier(
      tx,
      user.businessId,
      supplierId,
      parsed.data,
    );
    if (outcome.ok) {
      await recordAuditEntry(tx, {
        businessId: user.businessId,
        userId: user.id,
        actionType: "supplier.update",
        entityType: "supplier",
        entityId: supplierId,
        newValue: parsed.data,
      });
    }
    return outcome;
  });

  if (!result.ok) return { error: result.reason };

  revalidatePath(SUPPLIERS_PAGE, "page");
  return {};
}

export async function archiveSupplierAction(supplierId: number): Promise<void> {
  const user = await requireOwner();

  const db = getDb();
  await db.transaction(async (tx) => {
    const outcome = await archiveSupplier(tx, user.businessId, supplierId);
    if (outcome.ok) {
      await recordAuditEntry(tx, {
        businessId: user.businessId,
        userId: user.id,
        actionType: "supplier.archive",
        entityType: "supplier",
        entityId: supplierId,
      });
    }
  });

  revalidatePath(SUPPLIERS_PAGE, "page");
}

const confirmReviewedInputSchema = z.array(z.number().int().positive()).min(1);

export async function confirmSuppliersReviewedAction(
  supplierIds: number[],
): Promise<{ ok: boolean }> {
  const user = await requireOwner();

  const parsed = confirmReviewedInputSchema.safeParse(supplierIds);
  if (!parsed.success) return { ok: false };

  const db = getDb();
  await db.transaction(async (tx) => {
    await confirmSuppliersReviewed(tx, user.businessId, parsed.data);
    await recordAuditEntry(tx, {
      businessId: user.businessId,
      userId: user.id,
      actionType: "supplier.confirm_reviewed_bulk",
      entityType: "supplier",
      newValue: { supplierIds: parsed.data },
    });
  });

  revalidatePath(SUPPLIERS_PAGE, "page");
  return { ok: true };
}
