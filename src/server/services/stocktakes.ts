import { and, asc, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import { inventoryTable } from "@/db/schema/inventory";
import { productsTable } from "@/db/schema/products";
import { stocktakeItemsTable } from "@/db/schema/stocktake-items";
import { stocktakesTable } from "@/db/schema/stocktakes";
import { recordAuditEntry } from "@/server/audit";
import { adjustStock } from "./stock-adjustments";

type WritableDbOrTx = Pick<
  ReturnType<typeof getDb>,
  "select" | "insert" | "update"
>;

export type Stocktake = typeof stocktakesTable.$inferSelect;

/** The one open (draft) stocktake for a location, if any — resuming beats starting a duplicate. */
export async function getOpenStocktake(
  businessId: number,
  locationId: number,
): Promise<Stocktake | null> {
  const [stocktake] = await getDb()
    .select()
    .from(stocktakesTable)
    .where(
      and(
        eq(stocktakesTable.businessId, businessId),
        eq(stocktakesTable.locationId, locationId),
        eq(stocktakesTable.status, "draft"),
      ),
    )
    .orderBy(desc(stocktakesTable.createdAt))
    .limit(1);
  return stocktake ?? null;
}

export async function getStocktake(
  businessId: number,
  stocktakeId: number,
): Promise<Stocktake | null> {
  const [stocktake] = await getDb()
    .select()
    .from(stocktakesTable)
    .where(
      and(
        eq(stocktakesTable.id, stocktakeId),
        eq(stocktakesTable.businessId, businessId),
      ),
    );
  return stocktake ?? null;
}

/**
 * Opens a stocktake for a location: resumes the existing draft if one is already open (spec
 * 4.1's "chernetka zberihayetsya" — the draft is saved, can continue later), otherwise starts a
 * fresh one and snapshots every active product's current stock at this location as
 * system_quantity. Products with no inventory row yet snapshot at 0, not skipped — the owner
 * still needs to confirm a never-stocked product truly has nothing on the shelf.
 */
export async function startStocktake(
  db: WritableDbOrTx,
  businessId: number,
  userId: number,
  locationId: number,
): Promise<Stocktake> {
  const existing = await getOpenStocktake(businessId, locationId);
  if (existing) return existing;

  const [stocktake] = await db
    .insert(stocktakesTable)
    .values({ businessId, locationId, createdBy: userId })
    .returning();

  const products = await db
    .select({ id: productsTable.id })
    .from(productsTable)
    .where(
      and(
        eq(productsTable.businessId, businessId),
        eq(productsTable.archived, false),
      ),
    );

  const stockRows = await db
    .select({
      productId: inventoryTable.productId,
      quantity: inventoryTable.quantity,
    })
    .from(inventoryTable)
    .where(eq(inventoryTable.locationId, locationId));
  const stockByProduct = new Map(
    stockRows.map((row) => [row.productId, row.quantity]),
  );

  if (products.length > 0) {
    await db.insert(stocktakeItemsTable).values(
      products.map((product) => ({
        stocktakeId: stocktake.id,
        productId: product.id,
        systemQuantity: stockByProduct.get(product.id) ?? 0,
      })),
    );
  }

  return stocktake;
}

export interface StocktakeItemRow {
  id: number;
  productId: number;
  productName: string;
  sku: string | null;
  categoryId: number;
  systemQuantity: number;
  countedQuantity: number | null;
  reason: "breakage" | "shortage" | "mis_sort" | "count_error" | "other" | null;
}

export async function listStocktakeItems(
  stocktakeId: number,
): Promise<StocktakeItemRow[]> {
  return getDb()
    .select({
      id: stocktakeItemsTable.id,
      productId: stocktakeItemsTable.productId,
      productName: productsTable.name,
      sku: productsTable.sku,
      categoryId: productsTable.categoryId,
      systemQuantity: stocktakeItemsTable.systemQuantity,
      countedQuantity: stocktakeItemsTable.countedQuantity,
      reason: stocktakeItemsTable.reason,
    })
    .from(stocktakeItemsTable)
    .innerJoin(
      productsTable,
      eq(productsTable.id, stocktakeItemsTable.productId),
    )
    .where(eq(stocktakeItemsTable.stocktakeId, stocktakeId))
    .orderBy(asc(productsTable.name));
}

export const saveStocktakeCountSchema = z.object({
  stocktakeId: z.number().int().positive(),
  productId: z.number().int().positive(),
  countedQuantity: z.number().int(),
  reason: z
    .enum(["breakage", "shortage", "mis_sort", "count_error", "other"])
    .nullable(),
});

export type SaveStocktakeCountInput = z.infer<typeof saveStocktakeCountSchema>;

export async function saveStocktakeCount(
  db: WritableDbOrTx,
  input: SaveStocktakeCountInput,
): Promise<void> {
  await db
    .update(stocktakeItemsTable)
    .set({
      countedQuantity: input.countedQuantity,
      reason: input.reason,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(stocktakeItemsTable.stocktakeId, input.stocktakeId),
        eq(stocktakeItemsTable.productId, input.productId),
      ),
    );
}

export type PostStocktakeResult =
  | { ok: true; discrepancyCount: number }
  | { ok: false; reason: "not_found" | "already_posted" };

/**
 * Whether a stocktake line needs an adjustment on posting (spec 4.1): only a counted line whose
 * count differs from the system snapshot is a discrepancy. An uncounted line (never recounted)
 * or a line counted at exactly the system value isn't — nothing to reconcile. Pure, so this one
 * rule is unit-testable without a database.
 */
export function needsStocktakeAdjustment(
  systemQuantity: number,
  countedQuantity: number | null,
): boolean {
  return countedQuantity !== null && countedQuantity !== systemQuantity;
}

/**
 * Posts every counted discrepancy as a stock_adjustments row linked to this stocktake (spec
 * 4.1: "on posting, all discrepancies go to the log together... and stock is aligned to
 * actual"), then closes the stocktake. Lines left uncounted, or counted at the same value as
 * the system, produce no adjustment — nothing to reconcile.
 */
export async function postStocktake(
  db: WritableDbOrTx,
  userId: number,
  businessId: number,
  stocktakeId: number,
): Promise<PostStocktakeResult> {
  const stocktake = await getStocktake(businessId, stocktakeId);
  if (!stocktake) return { ok: false, reason: "not_found" };
  if (stocktake.status === "posted") {
    return { ok: false, reason: "already_posted" };
  }

  const items = await listStocktakeItems(stocktakeId);
  let discrepancyCount = 0;

  for (const item of items) {
    const { countedQuantity } = item;
    if (
      countedQuantity === null ||
      !needsStocktakeAdjustment(item.systemQuantity, countedQuantity)
    ) {
      continue;
    }
    discrepancyCount += 1;
    const outcome = await adjustStock(db, userId, {
      productId: item.productId,
      locationId: stocktake.locationId,
      newQuantity: countedQuantity,
      reason: item.reason ?? "other",
      stocktakeId: stocktake.id,
    });
    if (outcome.ok) {
      await recordAuditEntry(db, {
        businessId,
        userId,
        actionType: "stock_adjustment.create",
        entityType: "stock_adjustment",
        entityId: outcome.adjustment.id,
        productId: item.productId,
        oldValue: { quantity: outcome.adjustment.oldQuantity },
        newValue: { quantity: outcome.adjustment.newQuantity },
        reason: item.reason ?? "other",
      });
    }
  }

  await db
    .update(stocktakesTable)
    .set({ status: "posted", completedAt: new Date() })
    .where(eq(stocktakesTable.id, stocktakeId));

  return { ok: true, discrepancyCount };
}
