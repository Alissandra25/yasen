"use server";

import { parse } from "csv-parse/sync";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db/client";
import { recordAuditEntry } from "@/server/audit";
import {
  applySupplierImportResolution,
  archiveSupplier,
  confirmSuppliersReviewed,
  createSupplier,
  importSuppliersFromRows,
  supplierInputSchema,
  updateSupplier,
  type SupplierCsvRow,
  type SupplierImportResolution,
} from "@/server/services/suppliers";
import { requireOwner } from "@/server/session";

const SUPPLIERS_PAGE = "/[locale]/(app)/suppliers";

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

export interface SupplierImportConflictView {
  existingId: number;
  existingName: string;
  csvRow: SupplierCsvRow;
}

export interface SupplierImportState {
  error?: "invalid_input" | "parse_error";
  createdCount?: number;
  conflicts?: SupplierImportConflictView[];
}

/** CSV columns: name (required), contacts, note. */
export async function importSuppliersCsvAction(
  _prevState: SupplierImportState,
  formData: FormData,
): Promise<SupplierImportState> {
  const user = await requireOwner();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "invalid_input" };
  }

  const text = await file.text();
  let records: Record<string, string>[];
  try {
    records = parse(text, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });
  } catch {
    return { error: "parse_error" };
  }

  const rows: SupplierCsvRow[] = records
    .map((record) => ({
      name: (record.name ?? "").trim(),
      contacts: record.contacts?.trim() || null,
      note: record.note?.trim() || null,
    }))
    .filter((row) => row.name.length > 0);

  if (rows.length === 0) {
    return { error: "invalid_input" };
  }

  const db = getDb();
  const result = await db.transaction(async (tx) => {
    const outcome = await importSuppliersFromRows(tx, user.businessId, rows);
    await recordAuditEntry(tx, {
      businessId: user.businessId,
      userId: user.id,
      actionType: "supplier.import_csv",
      entityType: "supplier",
      newValue: {
        createdCount: outcome.createdCount,
        conflictCount: outcome.conflicts.length,
      },
    });
    return outcome;
  });

  revalidatePath(SUPPLIERS_PAGE, "page");

  return {
    createdCount: result.createdCount,
    conflicts: result.conflicts.map((conflict) => ({
      existingId: conflict.existing.id,
      existingName: conflict.existing.name,
      csvRow: conflict.csvRow,
    })),
  };
}

export async function resolveSupplierImportConflictsAction(
  resolutions: {
    existingId: number;
    resolution: SupplierImportResolution;
    csvRow: SupplierCsvRow;
  }[],
): Promise<{ ok: boolean }> {
  const user = await requireOwner();
  if (resolutions.length === 0) return { ok: true };

  const db = getDb();
  await db.transaction(async (tx) => {
    for (const { existingId, resolution, csvRow } of resolutions) {
      const outcome = await applySupplierImportResolution(
        tx,
        user.businessId,
        existingId,
        resolution,
        csvRow,
      );
      if (outcome.ok) {
        await recordAuditEntry(tx, {
          businessId: user.businessId,
          userId: user.id,
          actionType: "supplier.import_resolve",
          entityType: "supplier",
          entityId: existingId,
          newValue: { resolution },
        });
      }
    }
  });

  revalidatePath(SUPPLIERS_PAGE, "page");
  return { ok: true };
}
