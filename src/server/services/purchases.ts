import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import { inventoryTable } from "@/db/schema/inventory";
import { productsTable } from "@/db/schema/products";
import { purchaseItemsTable } from "@/db/schema/purchase-items";
import { purchasesTable } from "@/db/schema/purchases";
import { suppliersTable } from "@/db/schema/suppliers";
import { normalizeName } from "@/lib/strings";
import {
  createProduct,
  maybeInsertPriceHistory,
  type Product,
} from "@/server/services/products";
import { createSupplierOnTheFly } from "@/server/services/suppliers";

type WritableDbOrTx = Pick<
  ReturnType<typeof getDb>,
  "select" | "insert" | "update"
>;

export type Purchase = typeof purchasesTable.$inferSelect;

export const purchaseLineInputSchema = z
  .object({
    productId: z.number().int().positive().nullable(),
    newProductName: z.string().trim().max(255).nullable(),
    newProductCategoryId: z.number().int().positive().nullable(),
    newProductSku: z.string().trim().max(100).nullable(),
    locationId: z.number().int().positive(),
    quantity: z.number().int().positive(),
    // Already parsed via src/lib/money.ts at the action layer — never a raw string here.
    purchasePrice: z.number().int().nonnegative(),
    salePrice: z.number().int().nonnegative().nullable(),
  })
  .refine(
    (line) =>
      line.productId !== null ||
      (line.newProductName !== null && line.newProductCategoryId !== null),
    {
      message:
        "A line needs either an existing product or a new product's name and category together.",
    },
  );

export type PurchaseLineInput = z.infer<typeof purchaseLineInputSchema>;

export const postPurchaseInputSchema = z
  .object({
    supplierId: z.number().int().positive().nullable(),
    newSupplierName: z.string().trim().max(255).nullable(),
    defaultLocationId: z.number().int().positive(),
    lines: z.array(purchaseLineInputSchema).min(1),
  })
  .refine((input) => input.supplierId !== null || !!input.newSupplierName, {
    message: "Either an existing supplier or a new supplier name is required.",
  });

export type PostPurchaseInput = z.infer<typeof postPurchaseInputSchema>;

/**
 * Starting min_stock for a product quick-created from a receipt (spec 3.3): 10% of the
 * received quantity, rounded up, never less than 1.
 */
export function computeStartingMinStock(receivedQuantity: number): number {
  return Math.max(1, Math.ceil(receivedQuantity * 0.1));
}

/**
 * Posts a goods receipt in one transaction (spec 3.3): resolves/creates the supplier, inserts
 * the header, then for each line resolves/creates the product, inserts the line, and upserts
 * inventory at that line's location. price_history gets exactly one row per product per
 * receipt even when a product is split across several lines — the FIRST line's price for a
 * product wins; the UI is responsible for keeping split-line prices in sync, so this does not
 * defensively re-validate that later lines of the same product agree.
 */
export async function postPurchase(
  db: WritableDbOrTx,
  businessId: number,
  userId: number,
  effectiveFrom: string,
  input: PostPurchaseInput,
): Promise<{ purchase: Purchase }> {
  let supplierId = input.supplierId;
  if (supplierId === null && input.newSupplierName) {
    const result = await createSupplierOnTheFly(
      db,
      businessId,
      input.newSupplierName,
    );
    supplierId = result.supplier.id;
  }

  const [purchase] = await db
    .insert(purchasesTable)
    .values({
      businessId,
      supplierId: supplierId as number,
      defaultLocationId: input.defaultLocationId,
      createdBy: userId,
    })
    .returning();

  const priceByProduct = new Map<
    number,
    { purchasePrice: number; salePrice: number | null }
  >();
  // A product quick-created from this same receipt's own lines (e.g. a split line for a
  // product that doesn't exist yet) is reused by name within this receipt, not re-created —
  // same dedup intent as importProductsFromRows's in-batch name matching. min_stock is based
  // on the TOTAL received across every such line, not just the first one encountered.
  const newProductIdByName = new Map<string, number>();
  const newProductTotalQuantityByName = new Map<string, number>();
  for (const line of input.lines) {
    if (line.productId === null) {
      const key = normalizeName(line.newProductName as string);
      newProductTotalQuantityByName.set(
        key,
        (newProductTotalQuantityByName.get(key) ?? 0) + line.quantity,
      );
    }
  }

  for (const line of input.lines) {
    let productId = line.productId;
    if (productId === null) {
      const key = normalizeName(line.newProductName as string);
      const reused = newProductIdByName.get(key);
      if (reused !== undefined) {
        productId = reused;
      } else {
        const newProduct: Product = await createProduct(db, businessId, {
          name: line.newProductName as string,
          sku: line.newProductSku,
          categoryId: line.newProductCategoryId as number,
          defaultSupplierId: supplierId,
          minStock: computeStartingMinStock(
            newProductTotalQuantityByName.get(key) as number,
          ),
          purchasePrice: null,
          salePrice: null,
          effectiveFrom: null,
          needsReview: true,
        });
        productId = newProduct.id;
        newProductIdByName.set(key, productId);
      }
    }

    if (!priceByProduct.has(productId)) {
      priceByProduct.set(productId, {
        purchasePrice: line.purchasePrice,
        salePrice: line.salePrice,
      });
    }

    await db.insert(purchaseItemsTable).values({
      purchaseId: purchase.id,
      productId,
      locationId: line.locationId,
      quantity: line.quantity,
      purchasePrice: line.purchasePrice,
      salePrice: line.salePrice,
    });

    await db
      .insert(inventoryTable)
      .values({
        productId,
        locationId: line.locationId,
        quantity: line.quantity,
        lastMovementAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [inventoryTable.productId, inventoryTable.locationId],
        set: {
          quantity: sql`${inventoryTable.quantity} + ${line.quantity}`,
          lastMovementAt: new Date(),
        },
      });
  }

  for (const [productId, price] of priceByProduct) {
    await maybeInsertPriceHistory(
      db,
      productId,
      price.purchasePrice,
      price.salePrice,
      effectiveFrom,
    );
  }

  return { purchase };
}

// No db/tx parameter: standalone read called directly from a page.
export async function listPurchases(businessId: number) {
  return getDb()
    .select()
    .from(purchasesTable)
    .where(eq(purchasesTable.businessId, businessId));
}

export async function getPurchaseWithItems(
  businessId: number,
  purchaseId: number,
) {
  const db = getDb();
  const [purchase] = await db
    .select()
    .from(purchasesTable)
    .where(
      and(
        eq(purchasesTable.id, purchaseId),
        eq(purchasesTable.businessId, businessId),
      ),
    );
  if (!purchase) return null;

  const items = await db
    .select({
      id: purchaseItemsTable.id,
      productId: purchaseItemsTable.productId,
      productName: productsTable.name,
      locationId: purchaseItemsTable.locationId,
      quantity: purchaseItemsTable.quantity,
      purchasePrice: purchaseItemsTable.purchasePrice,
      salePrice: purchaseItemsTable.salePrice,
    })
    .from(purchaseItemsTable)
    .innerJoin(
      productsTable,
      eq(productsTable.id, purchaseItemsTable.productId),
    )
    .where(eq(purchaseItemsTable.purchaseId, purchaseId));

  return { purchase, items };
}

export interface PurchaseSummary {
  id: number;
  createdAt: Date;
  supplierId: number;
  supplierName: string;
  defaultLocationId: number;
  lineCount: number;
  totalQuantity: number;
}

/** Read-only summary for the receipts list page: one row per receipt with its line/quantity totals. */
export async function listPurchasesWithSummary(
  businessId: number,
): Promise<PurchaseSummary[]> {
  const db = getDb();
  const purchases = await db
    .select({
      id: purchasesTable.id,
      createdAt: purchasesTable.createdAt,
      supplierId: purchasesTable.supplierId,
      supplierName: suppliersTable.name,
      defaultLocationId: purchasesTable.defaultLocationId,
    })
    .from(purchasesTable)
    .innerJoin(suppliersTable, eq(suppliersTable.id, purchasesTable.supplierId))
    .where(eq(purchasesTable.businessId, businessId))
    .orderBy(desc(purchasesTable.createdAt));

  const items = await db
    .select({
      purchaseId: purchaseItemsTable.purchaseId,
      quantity: purchaseItemsTable.quantity,
    })
    .from(purchaseItemsTable)
    .innerJoin(
      purchasesTable,
      eq(purchasesTable.id, purchaseItemsTable.purchaseId),
    )
    .where(eq(purchasesTable.businessId, businessId));

  const aggregates = new Map<
    number,
    { lineCount: number; totalQuantity: number }
  >();
  for (const item of items) {
    const existing = aggregates.get(item.purchaseId) ?? {
      lineCount: 0,
      totalQuantity: 0,
    };
    existing.lineCount += 1;
    existing.totalQuantity += item.quantity;
    aggregates.set(item.purchaseId, existing);
  }

  return purchases.map((purchase) => ({
    ...purchase,
    lineCount: aggregates.get(purchase.id)?.lineCount ?? 0,
    totalQuantity: aggregates.get(purchase.id)?.totalQuantity ?? 0,
  }));
}
