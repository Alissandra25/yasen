import { and, asc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { inventoryTable } from "@/db/schema/inventory";
import { locationsTable } from "@/db/schema/locations";
import { productsTable } from "@/db/schema/products";

export interface InventoryRow {
  productId: number;
  productName: string;
  sku: string | null;
  categoryId: number;
  locationId: number;
  locationName: string;
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
      locationId: inventoryTable.locationId,
      locationName: locationsTable.name,
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
