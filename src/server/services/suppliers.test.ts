import { describe, expect, it, vi } from "vitest";
import {
  archiveSupplier,
  confirmSuppliersReviewed,
  createSupplier,
  createSupplierOnTheFly,
  normalizeSupplierName,
  updateSupplier,
} from "./suppliers";

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

  const updateWhere = vi
    .fn()
    .mockReturnValue({
      returning: vi.fn().mockResolvedValue(options.mutateReturning ?? []),
    });
  const updateSet = vi.fn().mockReturnValue({ where: updateWhere });
  const update = vi.fn().mockReturnValue({ set: updateSet });

  return {
    db: { select, insert, update } as unknown as Parameters<
      typeof createSupplier
    >[0],
    insertValues,
    updateSet,
    updateWhere,
  };
}

describe("normalizeSupplierName", () => {
  it("ignores case and collapses extra whitespace", () => {
    expect(normalizeSupplierName("Bosch Washing Machine")).toBe(
      normalizeSupplierName("bosch   washing machine "),
    );
  });
});

describe("createSupplier", () => {
  it("creates with needs_review false (a deliberate, full creation)", async () => {
    const row = { id: 1, name: "Acme" };
    const { db, insertValues } = createFakeDb({ mutateReturning: [row] });

    await createSupplier(db, 7, { name: "Acme", contacts: null, note: null });

    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ needsReview: false }),
    );
  });
});

describe("createSupplierOnTheFly", () => {
  it("reuses an existing supplier matched by normalized name", async () => {
    const existing = { id: 5, name: "bosch  washing machine" };
    const { db, insertValues } = createFakeDb({ selectRows: [existing] });

    const result = await createSupplierOnTheFly(db, 7, "Bosch Washing Machine");

    expect(result).toEqual({ supplier: existing, created: false });
    expect(insertValues).not.toHaveBeenCalled();
  });

  it("creates a new needs_review supplier when no name matches", async () => {
    const row = { id: 6, name: "New Co" };
    const { db, insertValues } = createFakeDb({
      selectRows: [],
      mutateReturning: [row],
    });

    const result = await createSupplierOnTheFly(db, 7, "New Co");

    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ name: "New Co", needsReview: true }),
    );
    expect(result).toEqual({ supplier: row, created: true });
  });
});

describe("updateSupplier", () => {
  it("returns not_found when no row matches", async () => {
    const { db } = createFakeDb({ mutateReturning: [] });

    const result = await updateSupplier(db, 7, 99, {
      name: "X",
      contacts: null,
      note: null,
    });

    expect(result).toEqual({ ok: false, reason: "not_found" });
  });

  it("clears needs_review on save, even without filling optional fields", async () => {
    const row = { id: 1, name: "Acme", needsReview: false };
    const { db, updateSet } = createFakeDb({ mutateReturning: [row] });

    const result = await updateSupplier(db, 7, 1, {
      name: "Acme",
      contacts: null,
      note: null,
    });

    expect(updateSet).toHaveBeenCalledWith(
      expect.objectContaining({ needsReview: false }),
    );
    expect(result).toEqual({ ok: true, supplier: row });
  });
});

describe("archiveSupplier", () => {
  it("returns not_found when no row matches", async () => {
    const { db } = createFakeDb({ mutateReturning: [] });

    const result = await archiveSupplier(db, 7, 99);

    expect(result).toEqual({ ok: false, reason: "not_found" });
  });
});

describe("confirmSuppliersReviewed", () => {
  it("does nothing for an empty id list", async () => {
    const { db, updateSet } = createFakeDb({});

    await confirmSuppliersReviewed(db, 7, []);

    expect(updateSet).not.toHaveBeenCalled();
  });

  it("clears needs_review for the given ids", async () => {
    const { db, updateSet, updateWhere } = createFakeDb({});

    await confirmSuppliersReviewed(db, 7, [1, 2, 3]);

    expect(updateSet).toHaveBeenCalledWith({ needsReview: false });
    expect(updateWhere).toHaveBeenCalledOnce();
  });
});
