import { describe, expect, it, vi } from "vitest";
import {
  archiveProduct,
  confirmProductsReviewed,
  createProduct,
  isArchiveCandidate,
  updateProduct,
} from "./products";

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

  const updateWhere = vi.fn().mockReturnValue({
    returning: vi.fn().mockResolvedValue(options.mutateReturning ?? []),
  });
  const updateSet = vi.fn().mockReturnValue({ where: updateWhere });
  const update = vi.fn().mockReturnValue({ set: updateSet });

  return {
    db: { select, insert, update } as unknown as Parameters<
      typeof createProduct
    >[0],
    insert,
    insertValues,
    updateSet,
  };
}

const baseFields = {
  name: "Dish soap",
  sku: null,
  categoryId: 1,
  defaultSupplierId: null,
  minStock: 0,
};

describe("isArchiveCandidate", () => {
  const cutoff = new Date("2026-09-01T00:00:00Z");

  it("is false when stock isn't zero", () => {
    expect(isArchiveCandidate(5, new Date("2026-01-01"), cutoff)).toBe(false);
  });

  it("is false when it has never moved (too new to judge)", () => {
    expect(isArchiveCandidate(0, null, cutoff)).toBe(false);
  });

  it("is false when the last movement is recent", () => {
    expect(isArchiveCandidate(0, new Date("2026-09-15"), cutoff)).toBe(false);
  });

  it("is true when stock is zero and the last movement predates the cutoff", () => {
    expect(isArchiveCandidate(0, new Date("2026-01-01"), cutoff)).toBe(true);
  });
});

describe("createProduct", () => {
  it("seeds an inventory row at 0 for every existing location", async () => {
    const product = { id: 1, name: "Dish soap" };
    const { db, insert, insertValues } = createFakeDb({
      selectRows: [{ id: 10 }, { id: 11 }],
      mutateReturning: [product],
    });

    await createProduct(db, 7, {
      ...baseFields,
      purchasePrice: null,
      salePrice: null,
      effectiveFrom: null,
    });

    expect(insert).toHaveBeenCalledTimes(2); // products, then inventory (no price given)
    expect(insertValues).toHaveBeenCalledWith([
      { productId: 1, locationId: 10, quantity: 0 },
      { productId: 1, locationId: 11, quantity: 0 },
    ]);
  });

  it("seeds a price_history row only when a purchase price is given", async () => {
    const product = { id: 2, name: "Detergent" };
    const { db, insert, insertValues } = createFakeDb({
      selectRows: [],
      mutateReturning: [product],
    });

    await createProduct(db, 7, {
      ...baseFields,
      purchasePrice: 15000,
      salePrice: 19900,
      effectiveFrom: "2026-10-12",
    });

    expect(insert).toHaveBeenCalledTimes(2); // products, then price_history (no locations)
    expect(insertValues).toHaveBeenCalledWith({
      productId: 2,
      purchasePrice: 15000,
      salePrice: 19900,
      effectiveFrom: "2026-10-12",
    });
  });

  it("throws if asked to insert a price without an effective date", async () => {
    const { db } = createFakeDb({ mutateReturning: [{ id: 3 }] });

    await expect(
      createProduct(db, 7, {
        ...baseFields,
        purchasePrice: 100,
        salePrice: null,
        effectiveFrom: null,
      }),
    ).rejects.toThrow();
  });
});

describe("updateProduct", () => {
  it("returns not_found when no row matches", async () => {
    const { db } = createFakeDb({ mutateReturning: [] });

    const result = await updateProduct(db, 7, 99, {
      ...baseFields,
      purchasePrice: null,
      salePrice: null,
      effectiveFrom: null,
    });

    expect(result).toEqual({ ok: false, reason: "not_found" });
  });

  it("clears needs_review on save", async () => {
    const row = { id: 1, needsReview: false };
    const { db, updateSet } = createFakeDb({ mutateReturning: [row] });

    const result = await updateProduct(db, 7, 1, {
      ...baseFields,
      purchasePrice: null,
      salePrice: null,
      effectiveFrom: null,
    });

    expect(updateSet).toHaveBeenCalledWith(
      expect.objectContaining({ needsReview: false }),
    );
    expect(result).toEqual({ ok: true, product: row });
  });
});

describe("archiveProduct", () => {
  it("returns not_found when no row matches", async () => {
    const { db } = createFakeDb({ mutateReturning: [] });

    const result = await archiveProduct(db, 7, 99);

    expect(result).toEqual({ ok: false, reason: "not_found" });
  });
});

describe("confirmProductsReviewed", () => {
  it("does nothing for an empty id list", async () => {
    const { db, updateSet } = createFakeDb({});

    await confirmProductsReviewed(db, 7, []);

    expect(updateSet).not.toHaveBeenCalled();
  });
});
