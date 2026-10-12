"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db/client";
import { businessToday } from "@/lib/dates";
import { moneyInputSchema, parseMoney } from "@/lib/money";
import { recordAuditEntry } from "@/server/audit";
import {
  archiveProduct,
  confirmProductsReviewed,
  createProduct,
  productFieldsSchema,
  updateProduct,
} from "@/server/services/products";
import { getCurrentBusiness } from "@/server/services/business";
import { requireOwner } from "@/server/session";

const PRODUCTS_PAGE = "/[locale]/(app)/products";

export interface ProductFormState {
  error?: "invalid_input" | "not_found";
}

/** Empty string means "no price given" — not every product has a price yet. */
function parseOptionalMoney(
  raw: FormDataEntryValue | null,
): number | null | "invalid" {
  if (raw === null || raw === "") return null;
  const parsed = moneyInputSchema.safeParse(raw);
  if (!parsed.success) return "invalid";
  return parseMoney(String(raw));
}

export async function createProductAction(
  _prevState: ProductFormState,
  formData: FormData,
): Promise<ProductFormState> {
  const user = await requireOwner();

  const parsedFields = productFieldsSchema.safeParse({
    name: formData.get("name"),
    sku: formData.get("sku"),
    categoryId: formData.get("categoryId"),
    defaultSupplierId: formData.get("defaultSupplierId"),
    minStock: formData.get("minStock"),
  });
  const purchasePrice = parseOptionalMoney(formData.get("purchasePrice"));
  const salePrice = parseOptionalMoney(formData.get("salePrice"));
  if (
    !parsedFields.success ||
    purchasePrice === "invalid" ||
    salePrice === "invalid"
  ) {
    return { error: "invalid_input" };
  }

  const business = await getCurrentBusiness();
  const effectiveFrom =
    purchasePrice !== null
      ? businessToday(business?.timezone ?? "Europe/Kyiv")
      : null;

  const db = getDb();
  await db.transaction(async (tx) => {
    const product = await createProduct(tx, user.businessId, {
      ...parsedFields.data,
      purchasePrice,
      salePrice,
      effectiveFrom,
    });
    await recordAuditEntry(tx, {
      businessId: user.businessId,
      userId: user.id,
      actionType: "product.create",
      entityType: "product",
      entityId: product.id,
      productId: product.id,
      newValue: { ...parsedFields.data, purchasePrice, salePrice },
    });
  });

  revalidatePath(PRODUCTS_PAGE, "page");
  return {};
}

export async function updateProductAction(
  productId: number,
  _prevState: ProductFormState,
  formData: FormData,
): Promise<ProductFormState> {
  const user = await requireOwner();

  const parsedFields = productFieldsSchema.safeParse({
    name: formData.get("name"),
    sku: formData.get("sku"),
    categoryId: formData.get("categoryId"),
    defaultSupplierId: formData.get("defaultSupplierId"),
    minStock: formData.get("minStock"),
  });
  const purchasePrice = parseOptionalMoney(formData.get("purchasePrice"));
  const salePrice = parseOptionalMoney(formData.get("salePrice"));
  if (
    !parsedFields.success ||
    purchasePrice === "invalid" ||
    salePrice === "invalid"
  ) {
    return { error: "invalid_input" };
  }

  const business = await getCurrentBusiness();
  const effectiveFrom =
    purchasePrice !== null
      ? businessToday(business?.timezone ?? "Europe/Kyiv")
      : null;

  const db = getDb();
  const result = await db.transaction(async (tx) => {
    const outcome = await updateProduct(tx, user.businessId, productId, {
      ...parsedFields.data,
      purchasePrice,
      salePrice,
      effectiveFrom,
    });
    if (outcome.ok) {
      await recordAuditEntry(tx, {
        businessId: user.businessId,
        userId: user.id,
        actionType: "product.update",
        entityType: "product",
        entityId: productId,
        productId,
        newValue: { ...parsedFields.data, purchasePrice, salePrice },
      });
    }
    return outcome;
  });

  if (!result.ok) return { error: result.reason };

  revalidatePath(PRODUCTS_PAGE, "page");
  return {};
}

export async function archiveProductAction(productId: number): Promise<void> {
  const user = await requireOwner();

  const db = getDb();
  await db.transaction(async (tx) => {
    const outcome = await archiveProduct(tx, user.businessId, productId);
    if (outcome.ok) {
      await recordAuditEntry(tx, {
        businessId: user.businessId,
        userId: user.id,
        actionType: "product.archive",
        entityType: "product",
        entityId: productId,
        productId,
      });
    }
  });

  revalidatePath(PRODUCTS_PAGE, "page");
}

const confirmReviewedInputSchema = z.array(z.number().int().positive()).min(1);

export async function confirmProductsReviewedAction(
  productIds: number[],
): Promise<{ ok: boolean }> {
  const user = await requireOwner();

  const parsed = confirmReviewedInputSchema.safeParse(productIds);
  if (!parsed.success) return { ok: false };

  const db = getDb();
  await db.transaction(async (tx) => {
    await confirmProductsReviewed(tx, user.businessId, parsed.data);
    await recordAuditEntry(tx, {
      businessId: user.businessId,
      userId: user.id,
      actionType: "product.confirm_reviewed_bulk",
      entityType: "product",
      newValue: { productIds: parsed.data },
    });
  });

  revalidatePath(PRODUCTS_PAGE, "page");
  return { ok: true };
}
