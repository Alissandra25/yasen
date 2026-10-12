import { describe, expect, it, vi } from "vitest";
import { postTransfer } from "./transfers";

function createFakeDb(options: {
  selectQueue?: unknown[][];
  insertReturningQueue?: unknown[][];
}) {
  const selectQueue = [...(options.selectQueue ?? [])];
  const insertReturningQueue = [...(options.insertReturningQueue ?? [])];

  const selectWhere = vi
    .fn()
    .mockImplementation(() =>
      Promise.resolve(selectQueue.length > 0 ? selectQueue.shift() : []),
    );
  const selectFrom = vi.fn().mockReturnValue({ where: selectWhere });
  const select = vi.fn().mockReturnValue({ from: selectFrom });

  const onConflictDoUpdate = vi.fn().mockResolvedValue(undefined);
  const insertValues = vi.fn().mockImplementation(() => ({
    returning: vi
      .fn()
      .mockImplementation(() =>
        Promise.resolve(
          insertReturningQueue.length > 0 ? insertReturningQueue.shift() : [],
        ),
      ),
    onConflictDoUpdate,
  }));
  const insert = vi.fn().mockReturnValue({ values: insertValues });

  const updateWhere = vi.fn().mockResolvedValue(undefined);
  const updateSet = vi.fn().mockReturnValue({ where: updateWhere });
  const update = vi.fn().mockReturnValue({ set: updateSet });

  return {
    db: { select, insert, update } as unknown as Parameters<
      typeof postTransfer
    >[0],
    insert,
    insertValues,
    updateSet,
    onConflictDoUpdate,
  };
}

describe("postTransfer", () => {
  it("rejects a line that asks for more than the source location has, before writing anything", async () => {
    const { db, insert } = createFakeDb({ selectQueue: [[{ quantity: 3 }]] });

    const result = await postTransfer(db, 7, 3, {
      fromLocationId: 1,
      toLocationId: 2,
      lines: [{ productId: 10, quantity: 5 }],
    });

    expect(result).toEqual({
      ok: false,
      reason: "insufficient_stock",
      productId: 10,
      available: 3,
      requested: 5,
    });
    expect(insert).not.toHaveBeenCalled();
  });

  it("treats no inventory row at the source as zero available", async () => {
    const { db } = createFakeDb({ selectQueue: [[]] });

    const result = await postTransfer(db, 7, 3, {
      fromLocationId: 1,
      toLocationId: 2,
      lines: [{ productId: 10, quantity: 1 }],
    });

    expect(result).toEqual({
      ok: false,
      reason: "insufficient_stock",
      productId: 10,
      available: 0,
      requested: 1,
    });
  });

  it("moves stock from source to destination and records the header and line", async () => {
    const transferRow = { id: 5 };
    const { db, insert, insertValues, updateSet, onConflictDoUpdate } =
      createFakeDb({
        selectQueue: [[{ quantity: 10 }]],
        insertReturningQueue: [[transferRow]],
      });

    const result = await postTransfer(db, 7, 3, {
      fromLocationId: 1,
      toLocationId: 2,
      lines: [{ productId: 10, quantity: 4 }],
    });

    expect(insert).toHaveBeenCalledTimes(3); // transfers header, transfer_items, destination upsert
    expect(insertValues).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ transferId: 5, productId: 10, quantity: 4 }),
    );
    expect(updateSet).toHaveBeenCalledWith(
      expect.objectContaining({ quantity: expect.anything() }),
    );
    expect(onConflictDoUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ target: expect.any(Array) }),
    );
    expect(result).toEqual({ ok: true, transfer: transferRow });
  });

  it("rejects transferring a location to itself", async () => {
    const { postTransferInputSchema } = await import("./transfers");
    expect(() =>
      postTransferInputSchema.parse({
        fromLocationId: 1,
        toLocationId: 1,
        lines: [{ productId: 10, quantity: 1 }],
      }),
    ).toThrow();
  });
});
