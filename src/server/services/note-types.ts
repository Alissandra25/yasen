import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import { noteTypesTable } from "@/db/schema/note-types";

type WritableDbOrTx = Pick<
  ReturnType<typeof getDb>,
  "select" | "insert" | "update"
>;

// Arbitrary per-business colour, like businesses.primary_color/accent_color (spec 13.1) — not a
// design-system token, so no Tailwind class validates it. #RGB or #RRGGBB, matching how a native
// <input type="color"> reports its value.
export const hexColorSchema = z
  .string()
  .trim()
  .regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "Expected a hex colour.");

export const noteTypeInputSchema = z.object({
  name: z.string().trim().min(1).max(100),
  color: hexColorSchema,
});

export type NoteTypeInput = z.infer<typeof noteTypeInputSchema>;

// No db/tx parameter, unlike the writes below: a standalone read called directly from a page,
// never from inside another transaction (same convention as listCategories / listLocations).
export async function listNoteTypes(businessId: number) {
  return getDb()
    .select()
    .from(noteTypesTable)
    .where(eq(noteTypesTable.businessId, businessId))
    .orderBy(asc(noteTypesTable.sortOrder));
}

export async function createNoteType(
  db: WritableDbOrTx,
  businessId: number,
  input: NoteTypeInput,
) {
  const siblings = await db
    .select({ sortOrder: noteTypesTable.sortOrder })
    .from(noteTypesTable)
    .where(eq(noteTypesTable.businessId, businessId));
  const nextSortOrder =
    siblings.length === 0
      ? 0
      : Math.max(...siblings.map((s) => s.sortOrder)) + 1;

  const [noteType] = await db
    .insert(noteTypesTable)
    .values({
      businessId,
      name: input.name,
      color: input.color,
      sortOrder: nextSortOrder,
    })
    .returning();
  return noteType;
}

export type NoteTypeMutationResult =
  | { ok: true; noteType: typeof noteTypesTable.$inferSelect }
  | { ok: false; reason: "not_found" };

// Note types have no archived flag (spec 11 lists only id/business_id/name/color/sort_order) and
// product_notes.note_type_id is a required FK with no cascade, so deleting one isn't supported
// yet — only rename/recolour. Spec gap, recorded via spec-update.
export async function updateNoteType(
  db: WritableDbOrTx,
  businessId: number,
  noteTypeId: number,
  input: NoteTypeInput,
): Promise<NoteTypeMutationResult> {
  const [noteType] = await db
    .update(noteTypesTable)
    .set({ name: input.name, color: input.color })
    .where(
      and(
        eq(noteTypesTable.id, noteTypeId),
        eq(noteTypesTable.businessId, businessId),
      ),
    )
    .returning();

  if (!noteType) return { ok: false, reason: "not_found" };
  return { ok: true, noteType };
}
