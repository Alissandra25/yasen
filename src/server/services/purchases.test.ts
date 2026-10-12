import { describe, expect, it, vi } from "vitest";
import { computeStartingMinStock, postPurchase } from "./purchases";

// A queue-based fake: each distinct call site under test consumes the next queued value, in
// the exact order postPurchase (and the services it calls into — createSupplierOnTheFly,
// createProduct, maybeInsertPriceHistory) issues them. Unlike products.test.ts's static fake
// (fine for single-call tests), postPurchase makes several different selects/returning-inserts
// in one transaction, so a static value can't tell them apart.
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

  const update = vi.fn();

  return {
    db: { select, insert, update } as unknown as Parameters<
      typeof postPurchase
    >[0],
    select,
    selectWhere,
    insert,
    insertValues,
    onConflictDoUpdate,
  };
}

describe("computeStartingMinStock", () => {
  it("rounds up to 10% of the received quantity", () => {
    expect(computeStartingMinStock(100)).toBe(10);
    expect(computeStartingMinStock(25)).toBe(3);
  });

  it("is never less than 1", () => {
    expect(computeStartingMinStock(1)).toBe(1);
    expect(computeStartingMinStock(5)).toBe(1);
  });
});

const baseInput = {
  newSupplierName: null,
  defaultLocationId: 1,
};

describe("postPurchase", () => {
  it("inserts the header and upserts inventory for an existing supplier and product", async () => {
    const purchaseRow = { id: 50 };
    const { db, insert, insertValues, onConflictDoUpdate } = createFakeDb({
      insertReturningQueue: [[purchaseRow]],
    });

    const result = await postPurchase(db, 7, 3, "2026-10-12", {
      ...baseInput,
      supplierId: 9,
      lines: [
        {
          productId: 100,
          newProductName: null,
          newProductCategoryId: null,
          newProductSku: null,
          locationId: 1,
          quantity: 20,
          purchasePrice: 1500,
          salePrice: 1900,
        },
      ],
    });

    expect(result).toEqual({ purchase: purchaseRow });
    expect(insert).toHaveBeenCalledTimes(4); // purchases, purchase_items, inventory, price_history
    expect(insertValues).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        purchaseId: 50,
        productId: 100,
        locationId: 1,
        quantity: 20,
        purchasePrice: 1500,
        salePrice: 1900,
      }),
    );
    expect(onConflictDoUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        target: expect.any(Array),
        set: expect.objectContaining({ quantity: expect.anything() }),
      }),
    );
  });

  it("records exactly one price_history row per product even when a line is split", async () => {
    const purchaseRow = { id: 51 };
    const { db, insert: insertSpy } = createFakeDb({
      insertReturningQueue: [[purchaseRow]],
    });

    await postPurchase(db, 7, 3, "2026-10-12", {
      ...baseInput,
      supplierId: 9,
      lines: [
        {
          productId: 100,
          newProductName: null,
          newProductCategoryId: null,
          newProductSku: null,
          locationId: 1,
          quantity: 12,
          purchasePrice: 1500,
          salePrice: null,
        },
        {
          productId: 100,
          newProductName: null,
          newProductCategoryId: null,
          newProductSku: null,
          locationId: 2,
          quantity: 8,
          purchasePrice: 1500,
          salePrice: null,
        },
      ],
    });

    // purchases + 2x purchase_items + 2x inventory + exactly 1x price_history = 6
    expect(insertSpy).toHaveBeenCalledTimes(6);
  });

  it("creates the supplier on the fly from a bare name", async () => {
    const supplierRow = { id: 60, name: "Acme" };
    const purchaseRow = { id: 52 };
    const { db, insertValues } = createFakeDb({
      selectQueue: [[]], // no existing supplier matches "Acme"
      insertReturningQueue: [[supplierRow], [purchaseRow]],
    });

    const result = await postPurchase(db, 7, 3, "2026-10-12", {
      ...baseInput,
      supplierId: null,
      newSupplierName: "Acme",
      lines: [
        {
          productId: 100,
          newProductName: null,
          newProductCategoryId: null,
          newProductSku: null,
          locationId: 1,
          quantity: 5,
          purchasePrice: 1000,
          salePrice: null,
        },
      ],
    });

    expect(insertValues).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ name: "Acme", needsReview: true }),
    );
    expect(result.purchase).toEqual(purchaseRow);
  });

  it("quick-creates a new product with needs_review and the computed starting min_stock", async () => {
    const productRow = { id: 101, name: "New Product" };
    const purchaseRow = { id: 53 };
    const { db, insertValues } = createFakeDb({
      selectQueue: [[]], // createProduct's own location lookup: no locations configured
      insertReturningQueue: [[purchaseRow], [productRow]],
    });

    await postPurchase(db, 7, 3, "2026-10-12", {
      ...baseInput,
      supplierId: 9,
      lines: [
        {
          productId: null,
          newProductName: "New Product",
          newProductCategoryId: 4,
          newProductSku: null,
          locationId: 1,
          quantity: 30,
          purchasePrice: 2000,
          salePrice: null,
        },
      ],
    });

    expect(insertValues).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        name: "New Product",
        categoryId: 4,
        minStock: 3,
        needsReview: true,
      }),
    );
  });

  it("reuses one quick-created product across split lines sharing the same new name, sized by the total quantity", async () => {
    const productRow = { id: 102, name: "Split New Product" };
    const purchaseRow = { id: 54 };
    const { db, insert, insertValues } = createFakeDb({
      selectQueue: [[]], // createProduct's location lookup, called only once thanks to dedup
      insertReturningQueue: [[purchaseRow], [productRow]],
    });

    await postPurchase(db, 7, 3, "2026-10-12", {
      ...baseInput,
      supplierId: 9,
      lines: [
        {
          productId: null,
          newProductName: "Split New Product",
          newProductCategoryId: 4,
          newProductSku: null,
          locationId: 1,
          quantity: 12,
          purchasePrice: 1500,
          salePrice: null,
        },
        {
          productId: null,
          newProductName: "split new product", // same name, different case/whitespace
          newProductCategoryId: 4,
          newProductSku: null,
          locationId: 2,
          quantity: 8,
          purchasePrice: 1500,
          salePrice: null,
        },
      ],
    });

    // min_stock is 10% of the TOTAL (12 + 8 = 20) rounded up, not just the first line's 12.
    expect(insertValues).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ name: "Split New Product", minStock: 2 }),
    );
    // purchases(1) + products(1) + purchase_items(2) + inventory(2) + price_history(1) = 7,
    // never a 2nd product insert
    expect(insert).toHaveBeenCalledTimes(7);
  });
});
