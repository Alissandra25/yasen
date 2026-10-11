import { describe, expect, it, vi } from "vitest";
import { createLocation, updateLocation } from "./locations";

function createFakeDb(returning: unknown[]) {
  const returningFn = vi.fn().mockResolvedValue(returning);
  const insertWhere = vi.fn().mockReturnValue({ returning: returningFn });
  const insertValues = vi.fn().mockReturnValue({ returning: returningFn });
  const insert = vi.fn().mockReturnValue({ values: insertValues });

  const updateWhere = vi.fn().mockReturnValue({ returning: returningFn });
  const updateSet = vi.fn().mockReturnValue({ where: updateWhere });
  const update = vi.fn().mockReturnValue({ set: updateSet });

  return {
    db: { insert, update } as unknown as Parameters<typeof createLocation>[0],
    insert,
    insertValues,
    update,
    updateSet,
    updateWhere,
    insertWhere,
  };
}

describe("createLocation", () => {
  it("inserts a location scoped to the business", async () => {
    const row = { id: 1, businessId: 7, name: "Warehouse", type: "warehouse" };
    const { db, insertValues } = createFakeDb([row]);

    const result = await createLocation(db, 7, {
      name: "Warehouse",
      type: "warehouse",
    });

    expect(insertValues).toHaveBeenCalledWith({
      businessId: 7,
      name: "Warehouse",
      type: "warehouse",
    });
    expect(result).toEqual(row);
  });
});

describe("updateLocation", () => {
  it("returns not_found when no row matches the business + id", async () => {
    const { db } = createFakeDb([]);

    const result = await updateLocation(db, 7, 99, {
      name: "Main shop",
      type: "shop",
    });

    expect(result).toEqual({ ok: false, reason: "not_found" });
  });

  it("returns the updated row on success", async () => {
    const row = { id: 1, businessId: 7, name: "Main shop", type: "shop" };
    const { db, updateSet } = createFakeDb([row]);

    const result = await updateLocation(db, 7, 1, {
      name: "Main shop",
      type: "shop",
    });

    expect(updateSet).toHaveBeenCalledWith({ name: "Main shop", type: "shop" });
    expect(result).toEqual({ ok: true, location: row });
  });
});
