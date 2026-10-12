"use server";

import { parse } from "csv-parse/sync";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db/client";
import { businessToday } from "@/lib/dates";
import { moneyInputSchema, parseMoney } from "@/lib/money";
import { normalizeName } from "@/lib/strings";
import { recordAuditEntry } from "@/server/audit";
import {
  applyProductImportResolution,
  archiveProduct,
  confirmProductsReviewed,
  createProduct,
  importProductsFromRows,
  productFieldsSchema,
  updateProduct,
  type ProductCsvRow,
  type ProductImportResolution,
} from "@/server/services/products";
import { getCurrentBusiness } from "@/server/services/business";
import { listCategories } from "@/server/services/categories";
import { createSupplierOnTheFly } from "@/server/services/suppliers";
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

export interface ProductImportConflictView {
  existingId: number;
  existingName: string;
  csvRow: ProductCsvRow;
}

export interface ProductImportRowError {
  name: string;
  reason: "unknown_category" | "invalid_price";
}

export interface ProductImportState {
  error?: "invalid_input" | "parse_error";
  createdCount?: number;
  conflicts?: ProductImportConflictView[];
  rowErrors?: ProductImportRowError[];
}

/**
 * CSV columns: name, category (required, matched by name against existing categories — an
 * unmatched category is a row error, not a conflict: unlike suppliers, there's no "create a
 * category on the fly" concept in the spec), supplier (optional, resolved the same
 * on-the-fly way goods receipts will), sku, minStock, purchasePrice, salePrice.
 */
export async function importProductsCsvAction(
  _prevState: ProductImportState,
  formData: FormData,
): Promise<ProductImportState> {
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

  const categories = await listCategories(user.businessId);
  const categoryIdByName = new Map(
    categories
      .filter((category) => !category.archived)
      .map((category) => [normalizeName(category.name), category.id]),
  );
  const business = await getCurrentBusiness();
  const today = businessToday(business?.timezone ?? "Europe/Kyiv");

  const db = getDb();
  const rows: ProductCsvRow[] = [];
  const rowErrors: ProductImportRowError[] = [];

  const result = await db.transaction(async (tx) => {
    for (const record of records) {
      const name = (record.name ?? "").trim();
      if (!name) continue;

      const categoryId = categoryIdByName.get(
        normalizeName(record.category ?? ""),
      );
      if (!categoryId) {
        rowErrors.push({ name, reason: "unknown_category" });
        continue;
      }

      const purchasePriceRaw = (record.purchasePrice ?? "").trim();
      const salePriceRaw = (record.salePrice ?? "").trim();
      if (
        (purchasePriceRaw &&
          !moneyInputSchema.safeParse(purchasePriceRaw).success) ||
        (salePriceRaw && !moneyInputSchema.safeParse(salePriceRaw).success)
      ) {
        rowErrors.push({ name, reason: "invalid_price" });
        continue;
      }
      const purchasePrice = purchasePriceRaw
        ? parseMoney(purchasePriceRaw)
        : null;
      const salePrice = salePriceRaw ? parseMoney(salePriceRaw) : null;

      const supplierName = (record.supplier ?? "").trim();
      const defaultSupplierId = supplierName
        ? (await createSupplierOnTheFly(tx, user.businessId, supplierName))
            .supplier.id
        : null;

      const minStockRaw = Number.parseInt((record.minStock ?? "").trim(), 10);
      const minStock =
        Number.isFinite(minStockRaw) && minStockRaw >= 0 ? minStockRaw : 0;

      rows.push({
        name,
        sku: record.sku?.trim() || null,
        categoryId,
        defaultSupplierId,
        minStock,
        purchasePrice,
        salePrice,
        effectiveFrom: purchasePrice !== null ? today : null,
      });
    }

    if (rows.length === 0) {
      return null;
    }

    const outcome = await importProductsFromRows(tx, user.businessId, rows);
    await recordAuditEntry(tx, {
      businessId: user.businessId,
      userId: user.id,
      actionType: "product.import_csv",
      entityType: "product",
      newValue: {
        createdCount: outcome.createdCount,
        conflictCount: outcome.conflicts.length,
        rowErrorCount: rowErrors.length,
      },
    });
    return outcome;
  });

  if (!result) {
    return rowErrors.length > 0
      ? { rowErrors, createdCount: 0, conflicts: [] }
      : { error: "invalid_input" };
  }

  revalidatePath(PRODUCTS_PAGE, "page");

  return {
    createdCount: result.createdCount,
    conflicts: result.conflicts.map((conflict) => ({
      existingId: conflict.existing.id,
      existingName: conflict.existing.name,
      csvRow: conflict.csvRow,
    })),
    rowErrors,
  };
}

export async function resolveProductImportConflictsAction(
  resolutions: {
    existingId: number;
    resolution: ProductImportResolution;
    csvRow: ProductCsvRow;
  }[],
): Promise<{ ok: boolean }> {
  const user = await requireOwner();
  if (resolutions.length === 0) return { ok: true };

  const db = getDb();
  await db.transaction(async (tx) => {
    for (const { existingId, resolution, csvRow } of resolutions) {
      const outcome = await applyProductImportResolution(
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
          actionType: "product.import_resolve",
          entityType: "product",
          entityId: existingId,
          newValue: { resolution },
        });
      }
    }
  });

  revalidatePath(PRODUCTS_PAGE, "page");
  return { ok: true };
}
