import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import { inventoryTable } from "@/db/schema/inventory";
import { locationsTable } from "@/db/schema/locations";
import { priceHistoryTable } from "@/db/schema/price-history";
import { productsTable } from "@/db/schema/products";
import { normalizeName } from "@/lib/strings";

type WritableDbOrTx = Pick<
  ReturnType<typeof getDb>,
  "select" | "insert" | "update"
>;

export type Product = typeof productsTable.$inferSelect;

function emptyToNull(value: unknown) {
  return value === "" || value === null || value === undefined ? null : value;
}

export const productFieldsSchema = z.object({
  name: z.string().trim().min(1).max(255),
  sku: z.preprocess(emptyToNull, z.string().trim().max(100).nullable()),
  categoryId: z.coerce.number().int().positive(),
  defaultSupplierId: z.preprocess(
    emptyToNull,
    z.coerce.number().int().positive().nullable(),
  ),
  minStock: z.coerce.number().int().min(0),
});

export type ProductFields = z.infer<typeof productFieldsSchema>;

export interface CreateProductInput extends ProductFields {
  /** Already converted via src/lib/money.ts, not a raw string — the action layer parses text. */
  purchasePrice: number | null;
  salePrice: number | null;
  /** Business-timezone 'YYYY-MM-DD' (src/lib/dates.ts); required when purchasePrice is set. */
  effectiveFrom: string | null;
  /** True for the future "quick-created from a receipt" path (milestone 6); false otherwise. */
  needsReview?: boolean;
}

export async function maybeInsertPriceHistory(
  db: WritableDbOrTx,
  productId: number,
  purchasePrice: number | null,
  salePrice: number | null,
  effectiveFrom: string | null,
) {
  // A row only ever exists with a purchase price (spec 11); nothing to insert without one.
  if (purchasePrice === null) return;
  if (effectiveFrom === null) {
    throw new Error("effectiveFrom is required when purchasePrice is set");
  }
  await db.insert(priceHistoryTable).values({
    productId,
    purchasePrice,
    salePrice,
    effectiveFrom,
  });
}

export async function createProduct(
  db: WritableDbOrTx,
  businessId: number,
  input: CreateProductInput,
): Promise<Product> {
  const [product] = await db
    .insert(productsTable)
    .values({
      businessId,
      name: input.name,
      sku: input.sku,
      categoryId: input.categoryId,
      defaultSupplierId: input.defaultSupplierId,
      minStock: input.minStock,
      needsReview: input.needsReview ?? false,
    })
    .returning();

  const locations = await db
    .select({ id: locationsTable.id })
    .from(locationsTable)
    .where(eq(locationsTable.businessId, businessId));
  if (locations.length > 0) {
    await db.insert(inventoryTable).values(
      locations.map((location) => ({
        productId: product.id,
        locationId: location.id,
        quantity: 0,
      })),
    );
  }

  await maybeInsertPriceHistory(
    db,
    product.id,
    input.purchasePrice,
    input.salePrice,
    input.effectiveFrom,
  );

  return product;
}

export interface UpdateProductInput extends ProductFields {
  purchasePrice: number | null;
  salePrice: number | null;
  effectiveFrom: string | null;
}

export type ProductMutationResult =
  { ok: true; product: Product } | { ok: false; reason: "not_found" };

/** Saving edits also confirms the record reviewed, same as suppliers (spec 3.1). */
export async function updateProduct(
  db: WritableDbOrTx,
  businessId: number,
  productId: number,
  input: UpdateProductInput,
): Promise<ProductMutationResult> {
  const [product] = await db
    .update(productsTable)
    .set({
      name: input.name,
      sku: input.sku,
      categoryId: input.categoryId,
      defaultSupplierId: input.defaultSupplierId,
      minStock: input.minStock,
      needsReview: false,
    })
    .where(
      and(
        eq(productsTable.id, productId),
        eq(productsTable.businessId, businessId),
      ),
    )
    .returning();

  if (!product) return { ok: false, reason: "not_found" };

  await maybeInsertPriceHistory(
    db,
    productId,
    input.purchasePrice,
    input.salePrice,
    input.effectiveFrom,
  );

  return { ok: true, product };
}

/** Bulk "Змінити категорію" action (spec mockup 11) — category only, nothing else touched. */
export async function bulkSetCategory(
  db: WritableDbOrTx,
  businessId: number,
  productIds: number[],
  categoryId: number,
): Promise<void> {
  await db
    .update(productsTable)
    .set({ categoryId })
    .where(
      and(
        eq(productsTable.businessId, businessId),
        inArray(productsTable.id, productIds),
      ),
    );
}

/** Moves every non-archived product out of one category into another (categories panel's "move all products" action). */
export async function reassignCategoryProducts(
  db: WritableDbOrTx,
  businessId: number,
  fromCategoryId: number,
  toCategoryId: number,
): Promise<void> {
  await db
    .update(productsTable)
    .set({ categoryId: toCategoryId })
    .where(
      and(
        eq(productsTable.businessId, businessId),
        eq(productsTable.categoryId, fromCategoryId),
        eq(productsTable.archived, false),
      ),
    );
}

export async function archiveProduct(
  db: WritableDbOrTx,
  businessId: number,
  productId: number,
): Promise<ProductMutationResult> {
  const [product] = await db
    .update(productsTable)
    .set({ archived: true })
    .where(
      and(
        eq(productsTable.id, productId),
        eq(productsTable.businessId, businessId),
      ),
    )
    .returning();

  if (!product) return { ok: false, reason: "not_found" };
  return { ok: true, product };
}

export async function confirmProductsReviewed(
  db: WritableDbOrTx,
  businessId: number,
  productIds: number[],
): Promise<void> {
  if (productIds.length === 0) return;
  await db
    .update(productsTable)
    .set({ needsReview: false })
    .where(
      and(
        eq(productsTable.businessId, businessId),
        inArray(productsTable.id, productIds),
      ),
    );
}

// No db/tx parameter: standalone reads called directly from a page.
export async function listProducts(businessId: number) {
  return getDb()
    .select()
    .from(productsTable)
    .where(eq(productsTable.businessId, businessId));
}

/** Every price change for one product, most recent first — the product detail panel's prices table. */
export async function listPriceHistory(productId: number) {
  return getDb()
    .select()
    .from(priceHistoryTable)
    .where(eq(priceHistoryTable.productId, productId))
    .orderBy(desc(priceHistoryTable.effectiveFrom));
}

interface PriceHistoryRow {
  productId: number;
  purchasePrice: number;
  salePrice: number | null;
  effectiveFrom: string;
}

/** Pure reduction (one row kept per product — the latest by effectiveFrom), testable without a database. */
export function pickLatestPrices(
  rows: PriceHistoryRow[],
): Map<number, { purchasePrice: number; salePrice: number | null }> {
  const latestByProduct = new Map<number, string>();
  const result = new Map<
    number,
    { purchasePrice: number; salePrice: number | null }
  >();
  for (const row of rows) {
    const latest = latestByProduct.get(row.productId);
    if (!latest || row.effectiveFrom > latest) {
      latestByProduct.set(row.productId, row.effectiveFrom);
      result.set(row.productId, {
        purchasePrice: row.purchasePrice,
        salePrice: row.salePrice,
      });
    }
  }
  return result;
}

/**
 * Each product's current purchase/sale price — the latest price_history row per product. Used by
 * the new-receipt page for the "↑ було 310 · націнка 52%" hints: the price entered on a line is
 * compared against what's already on record, not re-derived from the line itself.
 */
export async function listCurrentPrices(
  businessId: number,
): Promise<Map<number, { purchasePrice: number; salePrice: number | null }>> {
  const rows = await getDb()
    .select({
      productId: priceHistoryTable.productId,
      purchasePrice: priceHistoryTable.purchasePrice,
      salePrice: priceHistoryTable.salePrice,
      effectiveFrom: priceHistoryTable.effectiveFrom,
    })
    .from(priceHistoryTable)
    .innerJoin(productsTable, eq(productsTable.id, priceHistoryTable.productId))
    .where(eq(productsTable.businessId, businessId));

  return pickLatestPrices(rows);
}

/** Pure, so the archive-candidate rule (spec 3.1) is testable without a database. */
export function isArchiveCandidate(
  totalQuantity: number,
  lastMovementAt: Date | null,
  cutoff: Date,
): boolean {
  return (
    totalQuantity === 0 && lastMovementAt !== null && lastMovementAt < cutoff
  );
}

export async function getArchiveCandidateProductIds(
  businessId: number,
  archivePeriodMonths: number,
): Promise<number[]> {
  const db = getDb();
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - archivePeriodMonths);

  const aggregates = await db
    .select({
      productId: inventoryTable.productId,
      totalQuantity: inventoryTable.quantity,
      lastMovementAt: inventoryTable.lastMovementAt,
    })
    .from(inventoryTable)
    .innerJoin(productsTable, eq(productsTable.id, inventoryTable.productId))
    .where(
      and(
        eq(productsTable.businessId, businessId),
        eq(productsTable.archived, false),
      ),
    );

  const totals = new Map<
    number,
    { quantity: number; lastMovementAt: Date | null }
  >();
  for (const row of aggregates) {
    const existing = totals.get(row.productId) ?? {
      quantity: 0,
      lastMovementAt: null,
    };
    existing.quantity += row.totalQuantity;
    if (
      row.lastMovementAt &&
      (!existing.lastMovementAt || row.lastMovementAt > existing.lastMovementAt)
    ) {
      existing.lastMovementAt = row.lastMovementAt;
    }
    totals.set(row.productId, existing);
  }

  return Array.from(totals.entries())
    .filter(([, totals]) =>
      isArchiveCandidate(totals.quantity, totals.lastMovementAt, cutoff),
    )
    .map(([productId]) => productId);
}

export interface ProductCsvRow {
  name: string;
  sku: string | null;
  categoryId: number;
  defaultSupplierId: number | null;
  minStock: number;
  purchasePrice: number | null;
  salePrice: number | null;
  effectiveFrom: string | null;
}

export interface ProductImportConflict {
  csvRow: ProductCsvRow;
  existing: Product;
}

export interface ProductImportResult {
  createdCount: number;
  conflicts: ProductImportConflict[];
}

/** Same new-vs-conflict split as importSuppliersFromRows (spec 3.2), matched by product name. */
export async function importProductsFromRows(
  db: WritableDbOrTx,
  businessId: number,
  rows: ProductCsvRow[],
): Promise<ProductImportResult> {
  const existingRows = await db
    .select()
    .from(productsTable)
    .where(eq(productsTable.businessId, businessId));
  const byName = new Map(
    existingRows.map((row) => [normalizeName(row.name), row]),
  );

  let createdCount = 0;
  const conflicts: ProductImportConflict[] = [];

  for (const row of rows) {
    const key = normalizeName(row.name);
    const match = byName.get(key);
    if (match) {
      conflicts.push({ csvRow: row, existing: match });
      continue;
    }
    const created = await createProduct(db, businessId, row);
    byName.set(key, created);
    createdCount++;
  }

  return { createdCount, conflicts };
}

export type ProductImportResolution = "merge" | "overwrite" | "keep";

/**
 * merge/overwrite/keep (spec 3.2), same semantics as suppliers: merge only fills fields that are
 * genuinely empty on the existing row. category_id and min_stock are never "empty" (both
 * required/defaulted), so merge leaves them alone — only sku and default_supplier_id (both
 * nullable) can be filled in. price_history is append-only, not an in-place field, so both
 * resolutions add a new snapshot when the file provides a purchase price, rather than asking
 * what "empty" would even mean for a price.
 */
export async function applyProductImportResolution(
  db: WritableDbOrTx,
  businessId: number,
  existingId: number,
  resolution: ProductImportResolution,
  csvRow: ProductCsvRow,
): Promise<ProductMutationResult> {
  const [existing] = await db
    .select()
    .from(productsTable)
    .where(
      and(
        eq(productsTable.id, existingId),
        eq(productsTable.businessId, businessId),
      ),
    );
  if (!existing) return { ok: false, reason: "not_found" };

  let updated = existing;
  if (resolution === "overwrite") {
    [updated] = await db
      .update(productsTable)
      .set({
        sku: csvRow.sku,
        categoryId: csvRow.categoryId,
        defaultSupplierId: csvRow.defaultSupplierId,
        minStock: csvRow.minStock,
      })
      .where(eq(productsTable.id, existingId))
      .returning();
  } else if (resolution === "merge") {
    [updated] = await db
      .update(productsTable)
      .set({
        sku: existing.sku ?? csvRow.sku,
        defaultSupplierId:
          existing.defaultSupplierId ?? csvRow.defaultSupplierId,
      })
      .where(eq(productsTable.id, existingId))
      .returning();
  }

  if (resolution !== "keep" && csvRow.purchasePrice !== null) {
    await maybeInsertPriceHistory(
      db,
      existingId,
      csvRow.purchasePrice,
      csvRow.salePrice,
      csvRow.effectiveFrom,
    );
  }

  return { ok: true, product: updated };
}
