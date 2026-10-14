import { and, eq, gte, lte, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import { dateOnlySchema, compareDateStrings } from "@/lib/dates";
import { inventoryTable } from "@/db/schema/inventory";
import { priceHistoryTable } from "@/db/schema/price-history";
import { productsTable } from "@/db/schema/products";
import { purchaseItemsTable } from "@/db/schema/purchase-items";
import { purchasesTable } from "@/db/schema/purchases";
import { salesTable } from "@/db/schema/sales";

type WritableDbOrTx = Pick<
  ReturnType<typeof getDb>,
  "select" | "insert" | "update"
>;

export type Sale = typeof salesTable.$inferSelect;

export const recordSaleInputSchema = z.object({
  productId: z.number().int().positive(),
  locationId: z.number().int().positive(),
  // A signed delta, not an absolute cell value (sales are append-only — spec 3.6): positive
  // adds to the day's total, negative corrects a previous entry down. Never zero (a no-op
  // delta is filtered out before this is called).
  quantity: z
    .number()
    .int()
    .refine((value) => value !== 0),
  saleDate: dateOnlySchema,
  paymentMethod: z.enum(["cash", "card"]).nullable(),
  clientUuid: z.string().uuid().nullable(),
});

export type RecordSaleInput = z.infer<typeof recordSaleInputSchema>;

export type RecordSaleResult =
  | { ok: true; recorded: boolean; sale?: Sale }
  | { ok: false; reason: "no_price" };

/**
 * Looks up the sale price and purchase cost in effect on `saleDate` (spec 3.5: a backdated
 * entry uses the historical price, not today's), inserts the append-only sales row (deduped on
 * client_uuid via onConflictDoNothing, so a retried offline sync never double-counts), and
 * updates inventory by the same signed delta (allowed to go negative, per spec 4.1).
 */
export async function recordSale(
  db: WritableDbOrTx,
  userId: number,
  input: RecordSaleInput,
): Promise<RecordSaleResult> {
  const priceRows = await db
    .select({
      purchasePrice: priceHistoryTable.purchasePrice,
      salePrice: priceHistoryTable.salePrice,
      effectiveFrom: priceHistoryTable.effectiveFrom,
    })
    .from(priceHistoryTable)
    .where(eq(priceHistoryTable.productId, input.productId));

  const applicable = priceRows
    .filter((row) => compareDateStrings(row.effectiveFrom, input.saleDate) <= 0)
    .sort((a, b) => compareDateStrings(a.effectiveFrom, b.effectiveFrom))
    .at(-1);

  if (!applicable || applicable.salePrice === null) {
    return { ok: false, reason: "no_price" };
  }

  const [sale] = await db
    .insert(salesTable)
    .values({
      productId: input.productId,
      locationId: input.locationId,
      quantity: input.quantity,
      soldBy: userId,
      saleDate: input.saleDate,
      unitPrice: applicable.salePrice,
      unitCost: applicable.purchasePrice,
      paymentMethod: input.paymentMethod,
      clientUuid: input.clientUuid,
    })
    .onConflictDoNothing({ target: salesTable.clientUuid })
    .returning();

  if (!sale) {
    // A row with this client_uuid was already accepted — idempotent retry, not an error.
    return { ok: true, recorded: false };
  }

  await db
    .insert(inventoryTable)
    .values({
      productId: input.productId,
      locationId: input.locationId,
      quantity: -input.quantity,
      lastMovementAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [inventoryTable.productId, inventoryTable.locationId],
      set: {
        quantity: sql`${inventoryTable.quantity} - ${input.quantity}`,
        lastMovementAt: new Date(),
      },
    });

  return { ok: true, recorded: true, sale };
}

export interface MatrixCellTotal {
  productId: number;
  saleDate: string;
  paymentMethod: "cash" | "card" | null;
  quantity: number;
}

/** Sums every sales row into one total per (product, day[, payment method]) matrix cell. */
export async function getSalesTotals(
  businessId: number,
  locationId: number,
  fromDate: string,
  toDate: string,
): Promise<MatrixCellTotal[]> {
  const rows = await getDb()
    .select({
      productId: salesTable.productId,
      saleDate: salesTable.saleDate,
      paymentMethod: salesTable.paymentMethod,
      quantity: salesTable.quantity,
    })
    .from(salesTable)
    .innerJoin(productsTable, eq(productsTable.id, salesTable.productId))
    .where(
      and(
        eq(productsTable.businessId, businessId),
        eq(salesTable.locationId, locationId),
        gte(salesTable.saleDate, fromDate),
        lte(salesTable.saleDate, toDate),
      ),
    );

  const totals = new Map<string, MatrixCellTotal>();
  for (const row of rows) {
    const key = `${row.productId}|${row.saleDate}|${row.paymentMethod ?? ""}`;
    const existing = totals.get(key);
    if (existing) {
      existing.quantity += row.quantity;
    } else {
      totals.set(key, {
        productId: row.productId,
        saleDate: row.saleDate,
        paymentMethod: row.paymentMethod,
        quantity: row.quantity,
      });
    }
  }
  return Array.from(totals.values());
}

/** Current stock per product at one location — "stock now" on the matrix (spec 3.7). */
export async function getCurrentStock(
  businessId: number,
  locationId: number,
): Promise<Map<number, number>> {
  const rows = await getDb()
    .select({
      productId: inventoryTable.productId,
      quantity: inventoryTable.quantity,
    })
    .from(inventoryTable)
    .innerJoin(productsTable, eq(productsTable.id, inventoryTable.productId))
    .where(
      and(
        eq(productsTable.businessId, businessId),
        eq(inventoryTable.locationId, locationId),
      ),
    );
  return new Map(rows.map((row) => [row.productId, row.quantity]));
}

/**
 * "Stock at the start of the period" (spec 3.7, shown on the matrix alongside stock now):
 * reconstructed backwards from current stock, since no daily snapshots are kept —
 * start = current - receipts since the period start + sales since the period start.
 */
export async function getStockAtPeriodStart(
  businessId: number,
  locationId: number,
  periodStart: string,
): Promise<Map<number, number>> {
  const db = getDb();

  const currentStock = await getCurrentStock(businessId, locationId);

  const receiptRows = await db
    .select({
      productId: purchaseItemsTable.productId,
      quantity: purchaseItemsTable.quantity,
    })
    .from(purchaseItemsTable)
    .innerJoin(
      purchasesTable,
      eq(purchasesTable.id, purchaseItemsTable.purchaseId),
    )
    .where(
      and(
        eq(purchasesTable.businessId, businessId),
        eq(purchaseItemsTable.locationId, locationId),
        // Approximated as UTC midnight rather than business-timezone midnight: a few hours off
        // right at a month boundary, in keeping with this area's own "no daily snapshots, so
        // this is already a reconstruction" simplification (spec 3.7).
        gte(purchasesTable.createdAt, new Date(`${periodStart}T00:00:00.000Z`)),
      ),
    );

  const saleRows = await db
    .select({ productId: salesTable.productId, quantity: salesTable.quantity })
    .from(salesTable)
    .innerJoin(productsTable, eq(productsTable.id, salesTable.productId))
    .where(
      and(
        eq(productsTable.businessId, businessId),
        eq(salesTable.locationId, locationId),
        gte(salesTable.saleDate, periodStart),
      ),
    );

  const result = new Map<number, number>(currentStock);
  for (const row of receiptRows) {
    result.set(row.productId, (result.get(row.productId) ?? 0) - row.quantity);
  }
  for (const row of saleRows) {
    result.set(row.productId, (result.get(row.productId) ?? 0) + row.quantity);
  }
  return result;
}

/**
 * The sale price in effect on `asOfDate` for every product (spec 3.5.1's Day view shows a price
 * column). Same "pick the latest effective_from not after the date" rule as recordSale, just for
 * every product in the business at once instead of one product at insert time.
 */
export async function listCurrentSalePrices(
  businessId: number,
  asOfDate: string,
): Promise<Map<number, number>> {
  const rows = await getDb()
    .select({
      productId: priceHistoryTable.productId,
      salePrice: priceHistoryTable.salePrice,
      effectiveFrom: priceHistoryTable.effectiveFrom,
    })
    .from(priceHistoryTable)
    .innerJoin(productsTable, eq(productsTable.id, priceHistoryTable.productId))
    .where(
      and(
        eq(productsTable.businessId, businessId),
        lte(priceHistoryTable.effectiveFrom, asOfDate),
      ),
    );

  const latestByProduct = new Map<number, { effectiveFrom: string }>();
  const result = new Map<number, number>();
  for (const row of rows) {
    if (row.salePrice === null) continue;
    const latest = latestByProduct.get(row.productId);
    if (
      !latest ||
      compareDateStrings(row.effectiveFrom, latest.effectiveFrom) > 0
    ) {
      latestByProduct.set(row.productId, { effectiveFrom: row.effectiveFrom });
      result.set(row.productId, row.salePrice);
    }
  }
  return result;
}
