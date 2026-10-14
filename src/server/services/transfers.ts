import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import { inventoryTable } from "@/db/schema/inventory";
import { locationsTable } from "@/db/schema/locations";
import { transferItemsTable } from "@/db/schema/transfer-items";
import { transfersTable } from "@/db/schema/transfers";

type WritableDbOrTx = Pick<
  ReturnType<typeof getDb>,
  "select" | "insert" | "update"
>;

export type Transfer = typeof transfersTable.$inferSelect;

export const transferLineInputSchema = z.object({
  productId: z.number().int().positive(),
  quantity: z.number().int().positive(),
});

export type TransferLineInput = z.infer<typeof transferLineInputSchema>;

export const postTransferInputSchema = z
  .object({
    fromLocationId: z.number().int().positive(),
    toLocationId: z.number().int().positive(),
    lines: z.array(transferLineInputSchema).min(1),
  })
  .refine((input) => input.fromLocationId !== input.toLocationId, {
    message: "Source and destination must be different locations.",
  });

export type PostTransferInput = z.infer<typeof postTransferInputSchema>;

export type PostTransferResult =
  | { ok: true; transfer: Transfer }
  | {
      ok: false;
      reason: "insufficient_stock";
      productId: number;
      available: number;
      requested: number;
    };

/**
 * Posts a transfer in one transaction (spec 4.2). Unlike sales, a transfer IS blocked if a
 * line asks for more than the source location actually has — every line is checked against
 * current stock before anything is written, so the transfer is all-or-nothing, never partial.
 */
export async function postTransfer(
  db: WritableDbOrTx,
  businessId: number,
  userId: number,
  input: PostTransferInput,
): Promise<PostTransferResult> {
  for (const line of input.lines) {
    const [row] = await db
      .select({ quantity: inventoryTable.quantity })
      .from(inventoryTable)
      .where(
        and(
          eq(inventoryTable.productId, line.productId),
          eq(inventoryTable.locationId, input.fromLocationId),
        ),
      );
    const available = row?.quantity ?? 0;
    if (available < line.quantity) {
      return {
        ok: false,
        reason: "insufficient_stock",
        productId: line.productId,
        available,
        requested: line.quantity,
      };
    }
  }

  const [transfer] = await db
    .insert(transfersTable)
    .values({
      businessId,
      fromLocationId: input.fromLocationId,
      toLocationId: input.toLocationId,
      createdBy: userId,
    })
    .returning();

  for (const line of input.lines) {
    await db.insert(transferItemsTable).values({
      transferId: transfer.id,
      productId: line.productId,
      quantity: line.quantity,
    });

    await db
      .update(inventoryTable)
      .set({
        quantity: sql`${inventoryTable.quantity} - ${line.quantity}`,
        lastMovementAt: new Date(),
      })
      .where(
        and(
          eq(inventoryTable.productId, line.productId),
          eq(inventoryTable.locationId, input.fromLocationId),
        ),
      );

    await db
      .insert(inventoryTable)
      .values({
        productId: line.productId,
        locationId: input.toLocationId,
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

  return { ok: true, transfer };
}

export interface TransferSummary {
  id: number;
  createdAt: Date;
  fromLocationName: string;
  toLocationName: string;
  lineCount: number;
}

/** Read-only summary for the transfers list page: one row per transfer with its totals. */
export async function listTransfersWithSummary(
  businessId: number,
): Promise<TransferSummary[]> {
  const db = getDb();

  const transfers = await db
    .select({
      id: transfersTable.id,
      createdAt: transfersTable.createdAt,
      fromLocationId: transfersTable.fromLocationId,
      toLocationId: transfersTable.toLocationId,
    })
    .from(transfersTable)
    .where(eq(transfersTable.businessId, businessId))
    .orderBy(desc(transfersTable.createdAt));

  const locationNames = new Map(
    (await db.select().from(locationsTable)).map((location) => [
      location.id,
      location.name,
    ]),
  );

  const items = await db
    .select({
      transferId: transferItemsTable.transferId,
    })
    .from(transferItemsTable)
    .innerJoin(
      transfersTable,
      eq(transfersTable.id, transferItemsTable.transferId),
    )
    .where(eq(transfersTable.businessId, businessId));

  const lineCounts = new Map<number, number>();
  for (const item of items) {
    lineCounts.set(item.transferId, (lineCounts.get(item.transferId) ?? 0) + 1);
  }

  return transfers.map((transfer) => ({
    id: transfer.id,
    createdAt: transfer.createdAt,
    fromLocationName: locationNames.get(transfer.fromLocationId) ?? "",
    toLocationName: locationNames.get(transfer.toLocationId) ?? "",
    lineCount: lineCounts.get(transfer.id) ?? 0,
  }));
}
