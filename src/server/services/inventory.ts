import { and, asc, count, eq, lt } from "drizzle-orm";
import { getDb } from "@/db/client";
import { inventoryTable } from "@/db/schema/inventory";
import { locationsTable } from "@/db/schema/locations";
import { productsTable } from "@/db/schema/products";

export interface InventoryRow {
  productId: number;
  productName: string;
  sku: string | null;
  categoryId: number;
  minStock: number;
  locationId: number;
  locationName: string;
  locationType: "warehouse" | "shop";
  quantity: number;
  lastMovementAt: Date | null;
}

/**
 * Read-only stock view (spec 4.1): every active product's quantity at every location, for
 * negative-quantity rows to be highlighted in the UI as a reconciliation signal.
 */
export async function listInventory(
  businessId: number,
): Promise<InventoryRow[]> {
  return getDb()
    .select({
      productId: inventoryTable.productId,
      productName: productsTable.name,
      sku: productsTable.sku,
      categoryId: productsTable.categoryId,
      minStock: productsTable.minStock,
      locationId: inventoryTable.locationId,
      locationName: locationsTable.name,
      locationType: locationsTable.type,
      quantity: inventoryTable.quantity,
      lastMovementAt: inventoryTable.lastMovementAt,
    })
    .from(inventoryTable)
    .innerJoin(productsTable, eq(productsTable.id, inventoryTable.productId))
    .innerJoin(locationsTable, eq(locationsTable.id, inventoryTable.locationId))
    .where(
      and(
        eq(productsTable.businessId, businessId),
        eq(productsTable.archived, false),
      ),
    )
    .orderBy(asc(productsTable.name), asc(locationsTable.name));
}

/** Count of negative-stock rows for active products — the sidebar's Stock-levels badge. */
export async function countNegativeInventory(
  businessId: number,
): Promise<number> {
  const [row] = await getDb()
    .select({ value: count() })
    .from(inventoryTable)
    .innerJoin(productsTable, eq(productsTable.id, inventoryTable.productId))
    .where(
      and(
        eq(productsTable.businessId, businessId),
        eq(productsTable.archived, false),
        lt(inventoryTable.quantity, 0),
      ),
    );
  return row?.value ?? 0;
}
