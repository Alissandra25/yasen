import { and, asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import { suppliersTable } from "@/db/schema/suppliers";

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

/** Case/whitespace-insensitive match, reused by CSV import's duplicate detection (spec 3.2). */
export function normalizeSupplierName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

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
  const normalized = normalizeSupplierName(name);
  const existing = await db
    .select()
    .from(suppliersTable)
    .where(eq(suppliersTable.businessId, businessId));
  const match = existing.find(
    (supplier) => normalizeSupplierName(supplier.name) === normalized,
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
