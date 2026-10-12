import { describe, expect, it, vi } from "vitest";
import {
  applySupplierImportResolution,
  archiveSupplier,
  confirmSuppliersReviewed,
  createSupplier,
  createSupplierOnTheFly,
  importSuppliersFromRows,
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

  const updateWhere = vi.fn().mockReturnValue({
    returning: vi.fn().mockResolvedValue(options.mutateReturning ?? []),
  });
  const updateSet = vi.fn().mockReturnValue({ where: updateWhere });
  const update = vi.fn().mockReturnValue({ set: updateSet });

  return {
    db: { select, insert, update } as unknown as Parameters<
      typeof createSupplier
    >[0],
    insert,
    insertValues,
    update,
    updateSet,
    updateWhere,
  };
}

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

describe("importSuppliersFromRows", () => {
  it("creates rows with no existing match, and flags a name match as a conflict", async () => {
    const existing = { id: 1, name: "Acme Ltd" };
    const created = { id: 2, name: "New Co" };
    const { db, insertValues } = createFakeDb({
      selectRows: [existing],
      mutateReturning: [created],
    });

    const result = await importSuppliersFromRows(db, 7, [
      { name: "New Co", contacts: null, note: null },
      { name: "  acme  ltd ", contacts: "555-1234", note: null },
    ]);

    expect(insertValues).toHaveBeenCalledTimes(1);
    expect(result.createdCount).toBe(1);
    expect(result.conflicts).toEqual([
      {
        csvRow: { name: "  acme  ltd ", contacts: "555-1234", note: null },
        existing,
      },
    ]);
  });

  it("treats a repeated name within the same file as a conflict against the row just created", async () => {
    const created = { id: 3, name: "Dup Co" };
    const { db, insertValues } = createFakeDb({
      selectRows: [],
      mutateReturning: [created],
    });

    const result = await importSuppliersFromRows(db, 7, [
      { name: "Dup Co", contacts: null, note: null },
      { name: "dup co", contacts: "555-0000", note: null },
    ]);

    expect(insertValues).toHaveBeenCalledTimes(1);
    expect(result.createdCount).toBe(1);
    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0].existing).toEqual(created);
  });
});

describe("applySupplierImportResolution", () => {
  it("returns not_found when no row matches", async () => {
    const { db } = createFakeDb({ selectRows: [] });

    const result = await applySupplierImportResolution(db, 7, 99, "keep", {
      name: "X",
      contacts: null,
      note: null,
    });

    expect(result).toEqual({ ok: false, reason: "not_found" });
  });

  it("keep leaves the existing row untouched", async () => {
    const existing = { id: 1, name: "Acme", contacts: null, note: null };
    const { db, update } = createFakeDb({ selectRows: [existing] });

    const result = await applySupplierImportResolution(db, 7, 1, "keep", {
      name: "Acme",
      contacts: "555-1234",
      note: "note from file",
    });

    expect(update).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: true, supplier: existing });
  });

  it("overwrite replaces contacts/note with the file's values", async () => {
    const existing = { id: 1, name: "Acme", contacts: "old", note: "old note" };
    const updated = { id: 1, name: "Acme", contacts: "new", note: null };
    const { db, updateSet } = createFakeDb({
      selectRows: [existing],
      mutateReturning: [updated],
    });

    const result = await applySupplierImportResolution(db, 7, 1, "overwrite", {
      name: "Acme",
      contacts: "new",
      note: null,
    });

    expect(updateSet).toHaveBeenCalledWith({ contacts: "new", note: null });
    expect(result).toEqual({ ok: true, supplier: updated });
  });

  it("merge only fills fields that are currently empty on the existing row", async () => {
    const existing = { id: 1, name: "Acme", contacts: null, note: "kept" };
    const updated = {
      id: 1,
      name: "Acme",
      contacts: "from file",
      note: "kept",
    };
    const { db, updateSet } = createFakeDb({
      selectRows: [existing],
      mutateReturning: [updated],
    });

    const result = await applySupplierImportResolution(db, 7, 1, "merge", {
      name: "Acme",
      contacts: "from file",
      note: "ignored, existing already has a note",
    });

    expect(updateSet).toHaveBeenCalledWith({
      contacts: "from file",
      note: "kept",
    });
    expect(result).toEqual({ ok: true, supplier: updated });
  });
});
