import { and, eq, inArray, lte } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import { monthOnlySchema } from "@/lib/dates";
import { noteTypesTable } from "@/db/schema/note-types";
import { productNotesTable } from "@/db/schema/product-notes";
import { usersTable } from "@/db/schema/users";

type WritableDbOrTx = Pick<
  ReturnType<typeof getDb>,
  "select" | "insert" | "update" | "delete"
>;

export const productNoteInputSchema = z.object({
  productId: z.number().int().positive(),
  noteTypeId: z.number().int().positive(),
  text: z.string().trim().min(1).max(2000),
  // The "carry over to next month" toggle maps onto validTo: true → null (open-ended), false →
  // the note's own month (spec 11).
  carriesOver: z.boolean(),
  validFrom: monthOnlySchema,
});

export type ProductNoteInput = z.infer<typeof productNoteInputSchema>;

/** Pure, so the active-note rule (spec 11) is testable without a database. */
export function isNoteActiveForMonth(
  validFrom: string,
  validTo: string | null,
  month: string,
): boolean {
  if (validFrom > month) return false;
  if (validTo !== null && validTo < month) return false;
  return true;
}

export interface ActiveProductNote {
  id: number;
  productId: number;
  noteTypeId: number;
  noteTypeName: string;
  noteTypeColor: string;
  text: string;
  validFrom: string;
  validTo: string | null;
  carriesOver: boolean;
  createdByRole: string;
  createdAt: Date;
}

/**
 * Every active note (spec's active-for-month rule) for the given products, for the sales
 * matrix's coloured dots. One query for the whole visible product set rather than one per row.
 */
export async function listActiveProductNotes(
  businessId: number,
  productIds: number[],
  month: string,
): Promise<ActiveProductNote[]> {
  if (productIds.length === 0) return [];

  const rows = await getDb()
    .select({
      id: productNotesTable.id,
      productId: productNotesTable.productId,
      noteTypeId: productNotesTable.noteTypeId,
      noteTypeName: noteTypesTable.name,
      noteTypeColor: noteTypesTable.color,
      text: productNotesTable.text,
      validFrom: productNotesTable.validFrom,
      validTo: productNotesTable.validTo,
      createdByRole: usersTable.role,
      createdAt: productNotesTable.createdAt,
    })
    .from(productNotesTable)
    .innerJoin(
      noteTypesTable,
      eq(noteTypesTable.id, productNotesTable.noteTypeId),
    )
    .innerJoin(usersTable, eq(usersTable.id, productNotesTable.createdBy))
    .where(
      and(
        eq(productNotesTable.businessId, businessId),
        inArray(productNotesTable.productId, productIds),
        lte(productNotesTable.validFrom, month),
      ),
    );

  // The validFrom half of the active-note rule is filtered in SQL above; the validTo half
  // (null or >= month) is simpler to express once in isNoteActiveForMonth than in SQL, and this
  // query only ever runs over one month's worth of candidate rows.
  return rows
    .filter((row) => isNoteActiveForMonth(row.validFrom, row.validTo, month))
    .map((row) => ({
      ...row,
      carriesOver: row.validTo === null,
    }));
}

export async function createProductNote(
  db: WritableDbOrTx,
  businessId: number,
  userId: number,
  input: ProductNoteInput,
) {
  const [note] = await db
    .insert(productNotesTable)
    .values({
      businessId,
      productId: input.productId,
      noteTypeId: input.noteTypeId,
      text: input.text,
      validFrom: input.validFrom,
      validTo: input.carriesOver ? null : input.validFrom,
      createdBy: userId,
    })
    .returning();
  return note;
}

export type ProductNoteMutationResult =
  | { ok: true; note: typeof productNotesTable.$inferSelect }
  | { ok: false; reason: "not_found" };

export async function updateProductNote(
  db: WritableDbOrTx,
  businessId: number,
  noteId: number,
  input: ProductNoteInput,
): Promise<ProductNoteMutationResult> {
  const [note] = await db
    .update(productNotesTable)
    .set({
      noteTypeId: input.noteTypeId,
      text: input.text,
      validFrom: input.validFrom,
      validTo: input.carriesOver ? null : input.validFrom,
    })
    .where(
      and(
        eq(productNotesTable.id, noteId),
        eq(productNotesTable.businessId, businessId),
      ),
    )
    .returning();

  if (!note) return { ok: false, reason: "not_found" };
  return { ok: true, note };
}

export async function deleteProductNote(
  db: WritableDbOrTx,
  businessId: number,
  noteId: number,
): Promise<ProductNoteMutationResult> {
  const [note] = await db
    .delete(productNotesTable)
    .where(
      and(
        eq(productNotesTable.id, noteId),
        eq(productNotesTable.businessId, businessId),
      ),
    )
    .returning();

  if (!note) return { ok: false, reason: "not_found" };
  return { ok: true, note };
}
