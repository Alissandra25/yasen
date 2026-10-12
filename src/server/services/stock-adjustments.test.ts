import { describe, expect, it, vi } from "vitest";
import { adjustStock } from "./stock-adjustments";

function createFakeDb(options: {
  selectRows?: unknown[];
  mutateReturning?: unknown[];
}) {
  const selectWhere = vi.fn().mockResolvedValue(options.selectRows ?? []);
  const selectFrom = vi.fn().mockReturnValue({ where: selectWhere });
  const select = vi.fn().mockReturnValue({ from: selectFrom });

  const insertReturning = vi
    .fn()
    .mockResolvedValue(options.mutateReturning ?? []);
  const insertValues = vi.fn().mockReturnValue({ returning: insertReturning });
  const insert = vi.fn().mockReturnValue({ values: insertValues });

  const updateWhere = vi.fn().mockResolvedValue(undefined);
  const updateSet = vi.fn().mockReturnValue({ where: updateWhere });
  const update = vi.fn().mockReturnValue({ set: updateSet });

  return {
    db: { select, insert, update } as unknown as Parameters<
      typeof adjustStock
    >[0],
    insertValues,
    updateSet,
  };
}

describe("adjustStock", () => {
  it("returns not_found when no inventory row exists for that product/location", async () => {
    const { db } = createFakeDb({ selectRows: [] });

    const result = await adjustStock(db, 3, {
      productId: 1,
      locationId: 1,
      newQuantity: 5,
      reason: "breakage",
    });

    expect(result).toEqual({ ok: false, reason: "not_found" });
  });

  it("records the true prior quantity as old_quantity and the given reason", async () => {
    const adjustment = { id: 1, oldQuantity: 10, newQuantity: 7 };
    const { db, insertValues } = createFakeDb({
      selectRows: [{ quantity: 10 }],
      mutateReturning: [adjustment],
    });

    const result = await adjustStock(db, 3, {
      productId: 1,
      locationId: 1,
      newQuantity: 7,
      reason: "shortage",
    });

    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        oldQuantity: 10,
        newQuantity: 7,
        reason: "shortage",
        adjustedBy: 3,
      }),
    );
    expect(result).toEqual({ ok: true, adjustment });
  });

  it("aligns inventory to the new quantity", async () => {
    const { db, updateSet } = createFakeDb({
      selectRows: [{ quantity: 10 }],
      mutateReturning: [{ id: 1 }],
    });

    await adjustStock(db, 3, {
      productId: 1,
      locationId: 1,
      newQuantity: -4,
      reason: "other",
    });

    expect(updateSet).toHaveBeenCalledWith(
      expect.objectContaining({ quantity: -4 }),
    );
  });
});
