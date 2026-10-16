"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db/client";
import { recordAuditEntry } from "@/server/audit";
import {
  archiveCategory,
  categoryInputSchema,
  categoryNameSchema,
  createCategory,
  moveCategoryParent,
  renameCategory,
  reorderCategories,
} from "@/server/services/categories";
import { requireOwner } from "@/server/session";

const CATEGORIES_PAGE = "/[locale]/(app)/categories";

export interface CategoryFormState {
  error?: "invalid_input" | "not_found";
}

export async function createCategoryAction(
  _prevState: CategoryFormState,
  formData: FormData,
): Promise<CategoryFormState> {
  const user = await requireOwner();

  const parsed = categoryInputSchema.safeParse({
    name: formData.get("name"),
    parentId: formData.get("parentId"),
  });
  if (!parsed.success) {
    return { error: "invalid_input" };
  }

  const db = getDb();
  await db.transaction(async (tx) => {
    const category = await createCategory(tx, user.businessId, parsed.data);
    await recordAuditEntry(tx, {
      businessId: user.businessId,
      userId: user.id,
      actionType: "category.create",
      entityType: "category",
      entityId: category.id,
      newValue: parsed.data,
    });
  });

  revalidatePath(CATEGORIES_PAGE, "page");
  return {};
}

export async function renameCategoryAction(
  categoryId: number,
  _prevState: CategoryFormState,
  formData: FormData,
): Promise<CategoryFormState> {
  const user = await requireOwner();

  const parsed = categoryNameSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) {
    return { error: "invalid_input" };
  }

  const db = getDb();
  const result = await db.transaction(async (tx) => {
    const outcome = await renameCategory(
      tx,
      user.businessId,
      categoryId,
      parsed.data.name,
    );
    if (outcome.ok) {
      await recordAuditEntry(tx, {
        businessId: user.businessId,
        userId: user.id,
        actionType: "category.rename",
        entityType: "category",
        entityId: categoryId,
        newValue: { name: parsed.data.name },
      });
    }
    return outcome;
  });

  if (!result.ok) return { error: result.reason };

  revalidatePath(CATEGORIES_PAGE, "page");
  return {};
}

export async function archiveCategoryAction(categoryId: number): Promise<void> {
  const user = await requireOwner();

  const db = getDb();
  await db.transaction(async (tx) => {
    const outcome = await archiveCategory(tx, user.businessId, categoryId);
    if (outcome.ok) {
      await recordAuditEntry(tx, {
        businessId: user.businessId,
        userId: user.id,
        actionType: "category.archive",
        entityType: "category",
        entityId: categoryId,
      });
    }
  });

  revalidatePath(CATEGORIES_PAGE, "page");
}

const moveParentInputSchema = z.object({
  newParentId: z.number().int().positive(),
});

export async function moveCategoryParentAction(
  categoryId: number,
  newParentId: number,
): Promise<{ ok: boolean }> {
  const user = await requireOwner();

  const parsed = moveParentInputSchema.safeParse({ newParentId });
  if (!parsed.success) return { ok: false };

  const db = getDb();
  const result = await db.transaction(async (tx) => {
    const outcome = await moveCategoryParent(
      tx,
      user.businessId,
      categoryId,
      parsed.data.newParentId,
    );
    if (outcome.ok) {
      await recordAuditEntry(tx, {
        businessId: user.businessId,
        userId: user.id,
        actionType: "category.move",
        entityType: "category",
        entityId: categoryId,
        newValue: { parentId: parsed.data.newParentId },
      });
    }
    return outcome;
  });

  revalidatePath(CATEGORIES_PAGE, "page");
  return { ok: result.ok };
}

const reorderInputSchema = z.object({
  parentId: z.number().int().positive().nullable(),
  orderedIds: z.array(z.number().int().positive()).min(1),
});

export async function reorderCategoriesAction(
  parentId: number | null,
  orderedIds: number[],
): Promise<{ ok: boolean }> {
  const user = await requireOwner();

  const parsed = reorderInputSchema.safeParse({ parentId, orderedIds });
  if (!parsed.success) {
    return { ok: false };
  }

  const db = getDb();
  const result = await db.transaction(async (tx) => {
    const outcome = await reorderCategories(
      tx,
      user.businessId,
      parsed.data.parentId,
      parsed.data.orderedIds,
    );
    if (outcome.ok) {
      await recordAuditEntry(tx, {
        businessId: user.businessId,
        userId: user.id,
        actionType: "category.reorder",
        entityType: "category",
        newValue: {
          parentId: parsed.data.parentId,
          orderedIds: parsed.data.orderedIds,
        },
      });
    }
    return outcome;
  });

  revalidatePath(CATEGORIES_PAGE, "page");
  return { ok: result.ok };
}
