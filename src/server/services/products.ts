import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import { inventoryTable } from "@/db/schema/inventory";
import { locationsTable } from "@/db/schema/locations";
import { priceHistoryTable } from "@/db/schema/price-history";
import { productsTable } from "@/db/schema/products";

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

async function maybeInsertPriceHistory(
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
