import { and, asc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import { categoriesTable } from "@/db/schema/categories";

type WritableDbOrTx = Pick<
  ReturnType<typeof getDb>,
  "select" | "insert" | "update"
>;

const parentIdSchema = z.preprocess(
  (value) =>
    value === "" || value === null || value === undefined ? null : value,
  z.coerce.number().int().positive().nullable(),
);

export const categoryInputSchema = z.object({
  name: z.string().trim().min(1).max(255),
  parentId: parentIdSchema,
});

export type CategoryInput = z.infer<typeof categoryInputSchema>;

export const categoryNameSchema = z.object({
  name: z.string().trim().min(1).max(255),
});

function parentFilter(parentId: number | null) {
  return parentId === null
    ? isNull(categoriesTable.parentId)
    : eq(categoriesTable.parentId, parentId);
}

// No db/tx parameter, unlike the writes below: this is a standalone read called directly from a
// page (like getCurrentBusiness / listLocations), never from inside another transaction.
export async function listCategories(businessId: number) {
  return getDb()
    .select()
    .from(categoriesTable)
    .where(eq(categoriesTable.businessId, businessId))
    .orderBy(asc(categoriesTable.sortOrder));
}

export async function createCategory(
  db: WritableDbOrTx,
  businessId: number,
  input: CategoryInput,
) {
  const siblings = await db
    .select({ sortOrder: categoriesTable.sortOrder })
    .from(categoriesTable)
    .where(
      and(
        eq(categoriesTable.businessId, businessId),
        parentFilter(input.parentId),
      ),
    );
  const nextSortOrder =
    siblings.length === 0
      ? 0
      : Math.max(...siblings.map((s) => s.sortOrder)) + 1;

  const [category] = await db
    .insert(categoriesTable)
    .values({
      businessId,
      name: input.name,
      parentId: input.parentId,
      sortOrder: nextSortOrder,
    })
    .returning();
  return category;
}

export type CategoryMutationResult =
  | { ok: true; category: typeof categoriesTable.$inferSelect }
  | { ok: false; reason: "not_found" };

export async function renameCategory(
  db: WritableDbOrTx,
  businessId: number,
  categoryId: number,
  name: string,
): Promise<CategoryMutationResult> {
  const [category] = await db
    .update(categoriesTable)
    .set({ name })
    .where(
      and(
        eq(categoriesTable.id, categoryId),
        eq(categoriesTable.businessId, businessId),
      ),
    )
    .returning();

  if (!category) return { ok: false, reason: "not_found" };
  return { ok: true, category };
}

export async function archiveCategory(
  db: WritableDbOrTx,
  businessId: number,
  categoryId: number,
): Promise<CategoryMutationResult> {
  const [category] = await db
    .update(categoriesTable)
    .set({ archived: true })
    .where(
      and(
        eq(categoriesTable.id, categoryId),
        eq(categoriesTable.businessId, businessId),
      ),
    )
    .returning();

  if (!category) return { ok: false, reason: "not_found" };
  return { ok: true, category };
}

export type MoveCategoryResult =
  | { ok: true; category: typeof categoriesTable.$inferSelect }
  | { ok: false; reason: "not_found" | "invalid_target" };

/**
 * Re-parents a subcategory to a different top-level category (the detail panel's "Belongs to
 * category" select). Only ever moves a subcategory — a top-level category never gets a parent
 * through this, and the target must itself be an existing top-level category.
 */
export async function moveCategoryParent(
  db: WritableDbOrTx,
  businessId: number,
  categoryId: number,
  newParentId: number,
): Promise<MoveCategoryResult> {
  const [current] = await db
    .select()
    .from(categoriesTable)
    .where(
      and(
        eq(categoriesTable.id, categoryId),
        eq(categoriesTable.businessId, businessId),
      ),
    );
  if (!current || current.parentId === null) {
    return { ok: false, reason: "not_found" };
  }

  const [target] = await db
    .select()
    .from(categoriesTable)
    .where(
      and(
        eq(categoriesTable.id, newParentId),
        eq(categoriesTable.businessId, businessId),
        isNull(categoriesTable.parentId),
      ),
    );
  if (!target) {
    return { ok: false, reason: "invalid_target" };
  }

  const siblings = await db
    .select({ sortOrder: categoriesTable.sortOrder })
    .from(categoriesTable)
    .where(
      and(
        eq(categoriesTable.businessId, businessId),
        parentFilter(newParentId),
      ),
    );
  const nextSortOrder =
    siblings.length === 0
      ? 0
      : Math.max(...siblings.map((s) => s.sortOrder)) + 1;

  const [category] = await db
    .update(categoriesTable)
    .set({ parentId: newParentId, sortOrder: nextSortOrder })
    .where(
      and(
        eq(categoriesTable.id, categoryId),
        eq(categoriesTable.businessId, businessId),
      ),
    )
    .returning();

  return { ok: true, category };
}

export type ReorderResult = { ok: true } | { ok: false; reason: "invalid_ids" };

/**
 * Recalculates sort_order for one sibling group (same business + parent) from the given order.
 * Rejects (without writing anything) unless orderedIds is exactly that group's id set — this is
 * what stops a cross-parent drop: an id from a different parent won't be in the sibling set.
 */
export async function reorderCategories(
  db: WritableDbOrTx,
  businessId: number,
  parentId: number | null,
  orderedIds: number[],
): Promise<ReorderResult> {
  const siblings = await db
    .select({ id: categoriesTable.id })
    .from(categoriesTable)
    .where(
      and(eq(categoriesTable.businessId, businessId), parentFilter(parentId)),
    );
  const siblingIds = new Set(siblings.map((s) => s.id));

  const isValid =
    orderedIds.length === siblingIds.size &&
    orderedIds.every((id) => siblingIds.has(id));
  if (!isValid) {
    return { ok: false, reason: "invalid_ids" };
  }

  await Promise.all(
    orderedIds.map((id, index) =>
      db
        .update(categoriesTable)
        .set({ sortOrder: index })
        .where(eq(categoriesTable.id, id)),
    ),
  );
  return { ok: true };
}
