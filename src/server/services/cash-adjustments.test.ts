import { describe, expect, it, vi } from "vitest";
import { setDailyCashAdjustment } from "./cash-adjustments";

function createFakeDb(options: { mutateReturning?: unknown[] }) {
  const onConflictDoUpdate = vi.fn().mockReturnValue({
    returning: vi.fn().mockResolvedValue(options.mutateReturning ?? []),
  });
  const insertValues = vi.fn().mockReturnValue({ onConflictDoUpdate });
  const insert = vi.fn().mockReturnValue({ values: insertValues });

  return {
    db: { insert } as unknown as Parameters<typeof setDailyCashAdjustment>[0],
    insertValues,
    onConflictDoUpdate,
  };
}

describe("setDailyCashAdjustment", () => {
  it("stores the discount amount negated", async () => {
    const row = { id: 1, amount: -500 };
    const { db, insertValues } = createFakeDb({ mutateReturning: [row] });

    const result = await setDailyCashAdjustment(db, 7, 3, {
      locationId: 1,
      date: "2026-10-12",
      discountAmount: 500,
      note: "Military discount",
    });

    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ amount: -500, note: "Military discount" }),
    );
    expect(result).toEqual(row);
  });

  it("upserts on (location_id, date) so editing a day never creates a second row", async () => {
    const { db, onConflictDoUpdate } = createFakeDb({ mutateReturning: [{}] });

    await setDailyCashAdjustment(db, 7, 3, {
      locationId: 1,
      date: "2026-10-12",
      discountAmount: 0,
      note: null,
    });

    expect(onConflictDoUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ target: expect.any(Array) }),
    );
  });
});
