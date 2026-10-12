import { and, asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import { suppliersTable } from "@/db/schema/suppliers";
import { normalizeName } from "@/lib/strings";

type WritableDbOrTx = Pick<
  ReturnType<typeof getDb>,
  "select" | "insert" | "update"
>;

export type Supplier = typeof suppliersTable.$inferSelect;

export const supplierInputSchema = z.object({
  name: z.string().trim().min(1).max(255),
  contacts: z
    .string()
    .trim()
    .max(1000)
    .optional()
    .transform((value) => (value ? value : null)),
  note: z
    .string()
    .trim()
    .max(1000)
    .optional()
    .transform((value) => (value ? value : null)),
});

export type SupplierInput = z.infer<typeof supplierInputSchema>;

// No db/tx parameter, unlike the writes below: a standalone read called directly from a page.
export async function listSuppliers(businessId: number) {
  return getDb()
    .select()
    .from(suppliersTable)
    .where(eq(suppliersTable.businessId, businessId))
    .orderBy(asc(suppliersTable.name));
}

export async function createSupplier(
  db: WritableDbOrTx,
  businessId: number,
  input: SupplierInput,
): Promise<Supplier> {
  const [supplier] = await db
    .insert(suppliersTable)
    .values({
      businessId,
      name: input.name,
      contacts: input.contacts,
      note: input.note,
      needsReview: false,
    })
    .returning();
  return supplier;
}

export interface CreateSupplierOnTheFlyResult {
  supplier: Supplier;
  /** False when an existing supplier matched by name and was reused instead of creating a new one. */
  created: boolean;
}

/**
 * The "typed a bare name during a receipt" path (spec 3.1, used from goods receipts starting
 * milestone 6): reuses an existing supplier if the name matches one (case/whitespace-insensitive),
 * otherwise creates a new needs_review supplier with just a name.
 */
export async function createSupplierOnTheFly(
  db: WritableDbOrTx,
  businessId: number,
  name: string,
): Promise<CreateSupplierOnTheFlyResult> {
  const normalized = normalizeName(name);
  const existing = await db
    .select()
    .from(suppliersTable)
    .where(eq(suppliersTable.businessId, businessId));
  const match = existing.find(
    (supplier) => normalizeName(supplier.name) === normalized,
  );
  if (match) {
    return { supplier: match, created: false };
  }

  const [supplier] = await db
    .insert(suppliersTable)
    .values({ businessId, name: name.trim(), needsReview: true })
    .returning();
  return { supplier, created: true };
}

export type SupplierMutationResult =
  { ok: true; supplier: Supplier } | { ok: false; reason: "not_found" };

/** Saving edits also confirms the record reviewed (spec 3.1: "the flag is cleared even if something is still empty"). */
export async function updateSupplier(
  db: WritableDbOrTx,
  businessId: number,
  supplierId: number,
  input: SupplierInput,
): Promise<SupplierMutationResult> {
  const [supplier] = await db
    .update(suppliersTable)
    .set({
      name: input.name,
      contacts: input.contacts,
      note: input.note,
      needsReview: false,
    })
    .where(
      and(
        eq(suppliersTable.id, supplierId),
        eq(suppliersTable.businessId, businessId),
      ),
    )
    .returning();

  if (!supplier) return { ok: false, reason: "not_found" };
  return { ok: true, supplier };
}

export async function archiveSupplier(
  db: WritableDbOrTx,
  businessId: number,
  supplierId: number,
): Promise<SupplierMutationResult> {
  const [supplier] = await db
    .update(suppliersTable)
    .set({ archived: true })
    .where(
      and(
        eq(suppliersTable.id, supplierId),
        eq(suppliersTable.businessId, businessId),
      ),
    )
    .returning();

  if (!supplier) return { ok: false, reason: "not_found" };
  return { ok: true, supplier };
}

/** Bulk "select several, clear the flag on all of them in one action" (spec 3.1). */
export async function confirmSuppliersReviewed(
  db: WritableDbOrTx,
  businessId: number,
  supplierIds: number[],
): Promise<void> {
  if (supplierIds.length === 0) return;
  await db
    .update(suppliersTable)
    .set({ needsReview: false })
    .where(
      and(
        eq(suppliersTable.businessId, businessId),
        inArray(suppliersTable.id, supplierIds),
      ),
    );
}

export interface SupplierCsvRow {
  name: string;
  contacts: string | null;
  note: string | null;
}

export interface SupplierImportConflict {
  csvRow: SupplierCsvRow;
  existing: Supplier;
}

export interface SupplierImportResult {
  createdCount: number;
  conflicts: SupplierImportConflict[];
}

/**
 * New rows are created immediately; a name match against an existing supplier (or an earlier row
 * in this same file) becomes a conflict for the owner to resolve instead — never overwritten
 * without a decision (spec 3.2).
 */
export async function importSuppliersFromRows(
  db: WritableDbOrTx,
  businessId: number,
  rows: SupplierCsvRow[],
): Promise<SupplierImportResult> {
  const existingRows = await db
    .select()
    .from(suppliersTable)
    .where(eq(suppliersTable.businessId, businessId));
  const byName = new Map(
    existingRows.map((row) => [normalizeName(row.name), row]),
  );

  let createdCount = 0;
  const conflicts: SupplierImportConflict[] = [];

  for (const row of rows) {
    const key = normalizeName(row.name);
    const match = byName.get(key);
    if (match) {
      conflicts.push({ csvRow: row, existing: match });
      continue;
    }
    const [created] = await db
      .insert(suppliersTable)
      .values({
        businessId,
        name: row.name,
        contacts: row.contacts,
        note: row.note,
        needsReview: false,
      })
      .returning();
    byName.set(key, created);
    createdCount++;
  }

  return { createdCount, conflicts };
}

export type SupplierImportResolution = "merge" | "overwrite" | "keep";

/** merge fills only fields that are currently empty on the existing row; overwrite replaces; keep leaves it as is (spec 3.2). */
export async function applySupplierImportResolution(
  db: WritableDbOrTx,
  businessId: number,
  existingId: number,
  resolution: SupplierImportResolution,
  csvRow: SupplierCsvRow,
): Promise<SupplierMutationResult> {
  const [existing] = await db
    .select()
    .from(suppliersTable)
    .where(
      and(
        eq(suppliersTable.id, existingId),
        eq(suppliersTable.businessId, businessId),
      ),
    );
  if (!existing) return { ok: false, reason: "not_found" };

  if (resolution === "keep") {
    return { ok: true, supplier: existing };
  }

  const nextValues =
    resolution === "overwrite"
      ? { contacts: csvRow.contacts, note: csvRow.note }
      : {
          contacts: existing.contacts ?? csvRow.contacts,
          note: existing.note ?? csvRow.note,
        };

  const [updated] = await db
    .update(suppliersTable)
    .set(nextValues)
    .where(eq(suppliersTable.id, existingId))
    .returning();
  return { ok: true, supplier: updated };
}
