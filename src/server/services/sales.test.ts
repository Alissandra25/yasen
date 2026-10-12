import { describe, expect, it, vi } from "vitest";
import { recordSale } from "./sales";

function createFakeDb(options: {
  priceRows?: unknown[];
  insertReturningQueue?: unknown[][];
}) {
  const insertReturningQueue = [...(options.insertReturningQueue ?? [])];

  const selectWhere = vi.fn().mockResolvedValue(options.priceRows ?? []);
  const selectFrom = vi.fn().mockReturnValue({ where: selectWhere });
  const select = vi.fn().mockReturnValue({ from: selectFrom });

  const onConflictDoUpdate = vi.fn().mockResolvedValue(undefined);
  const onConflictDoNothing = vi.fn().mockReturnValue({
    returning: vi
      .fn()
      .mockImplementation(() =>
        Promise.resolve(
          insertReturningQueue.length > 0 ? insertReturningQueue.shift() : [],
        ),
      ),
  });
  const insertValues = vi.fn().mockReturnValue({
    onConflictDoNothing,
    onConflictDoUpdate,
  });
  const insert = vi.fn().mockReturnValue({ values: insertValues });

  const update = vi.fn();

  return {
    db: { select, insert, update } as unknown as Parameters<
      typeof recordSale
    >[0],
    insert,
    insertValues,
    onConflictDoUpdate,
  };
}

const priceRows = [
  {
    purchasePrice: 1000,
    salePrice: 1500,
    effectiveFrom: "2026-01-01",
  },
  {
    purchasePrice: 1200,
    salePrice: 1800,
    effectiveFrom: "2026-10-01",
  },
];

describe("recordSale", () => {
  it("uses the price effective on the sale date, not the latest price", async () => {
    const saleRow = { id: 1, unitPrice: 1500, unitCost: 1000 };
    const { db, insertValues } = createFakeDb({
      priceRows,
      insertReturningQueue: [[saleRow]],
    });

    const result = await recordSale(db, 3, {
      productId: 10,
      locationId: 1,
      quantity: 2,
      saleDate: "2026-09-15", // before the Oct 1 price change
      paymentMethod: null,
      clientUuid: null,
    });

    expect(insertValues).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ unitPrice: 1500, unitCost: 1000 }),
    );
    expect(result).toEqual({ ok: true, recorded: true, sale: saleRow });
  });

  it("uses the later price for a sale dated after the price change", async () => {
    const saleRow = { id: 2 };
    const { insertValues, db } = createFakeDb({
      priceRows,
      insertReturningQueue: [[saleRow]],
    });

    await recordSale(db, 3, {
      productId: 10,
      locationId: 1,
      quantity: 1,
      saleDate: "2026-10-05",
      paymentMethod: "cash",
      clientUuid: null,
    });

    expect(insertValues).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ unitPrice: 1800, unitCost: 1200 }),
    );
  });

  it("rejects when no price_history row applies yet", async () => {
    const { db } = createFakeDb({ priceRows: [] });

    const result = await recordSale(db, 3, {
      productId: 10,
      locationId: 1,
      quantity: 1,
      saleDate: "2026-09-15",
      paymentMethod: null,
      clientUuid: null,
    });

    expect(result).toEqual({ ok: false, reason: "no_price" });
  });

  it("rejects when the applicable price_history row has no sale price set", async () => {
    const { db } = createFakeDb({
      priceRows: [
        { purchasePrice: 1000, salePrice: null, effectiveFrom: "2026-01-01" },
      ],
    });

    const result = await recordSale(db, 3, {
      productId: 10,
      locationId: 1,
      quantity: 1,
      saleDate: "2026-09-15",
      paymentMethod: null,
      clientUuid: null,
    });

    expect(result).toEqual({ ok: false, reason: "no_price" });
  });

  it("decrements inventory by the signed delta, allowing it to go negative", async () => {
    const saleRow = { id: 3 };
    const { db, onConflictDoUpdate } = createFakeDb({
      priceRows,
      insertReturningQueue: [[saleRow]],
    });

    await recordSale(db, 3, {
      productId: 10,
      locationId: 1,
      quantity: 5,
      saleDate: "2026-09-15",
      paymentMethod: null,
      clientUuid: null,
    });

    expect(onConflictDoUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        target: expect.any(Array),
        set: expect.objectContaining({ quantity: expect.anything() }),
      }),
    );
  });

  it("a negative delta corrects a previous entry down and increases inventory back", async () => {
    const saleRow = { id: 4 };
    const { db, insertValues, insert } = createFakeDb({
      priceRows,
      insertReturningQueue: [[saleRow]],
    });

    const result = await recordSale(db, 3, {
      productId: 10,
      locationId: 1,
      quantity: -2,
      saleDate: "2026-09-15",
      paymentMethod: null,
      clientUuid: null,
    });

    expect(insertValues).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ quantity: -2 }),
    );
    expect(insert).toHaveBeenCalledTimes(2); // sales row, inventory upsert
    expect(result.ok).toBe(true);
  });

  it("treats a deduped client_uuid (no row returned) as recorded: false, not an error", async () => {
    const { db, insert } = createFakeDb({
      priceRows,
      insertReturningQueue: [[]], // onConflictDoNothing found an existing row
    });

    const result = await recordSale(db, 3, {
      productId: 10,
      locationId: 1,
      quantity: 2,
      saleDate: "2026-09-15",
      paymentMethod: null,
      clientUuid: "11111111-1111-1111-1111-111111111111",
    });

    expect(result).toEqual({ ok: true, recorded: false });
    expect(insert).toHaveBeenCalledTimes(1); // no inventory update for a deduped retry
  });
});
