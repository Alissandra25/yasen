import { describe, expect, it, vi } from "vitest";
import {
  archiveCategory,
  createCategory,
  renameCategory,
  reorderCategories,
} from "./categories";

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

  const updateReturning = vi
    .fn()
    .mockResolvedValue(options.mutateReturning ?? []);
  const updateWhere = vi.fn().mockReturnValue({ returning: updateReturning });
  const updateSet = vi.fn().mockReturnValue({ where: updateWhere });
  const update = vi.fn().mockReturnValue({ set: updateSet });

  return {
    db: { select, insert, update } as unknown as Parameters<
      typeof createCategory
    >[0],
    selectWhere,
    insertValues,
    updateSet,
  };
}

describe("createCategory", () => {
  it("places a first category at sort_order 0", async () => {
    const row = { id: 1, name: "Cleaning", parentId: null, sortOrder: 0 };
    const { db, insertValues } = createFakeDb({
      selectRows: [],
      mutateReturning: [row],
    });

    const result = await createCategory(db, 7, {
      name: "Cleaning",
      parentId: null,
    });

    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ sortOrder: 0 }),
    );
    expect(result).toEqual(row);
  });

  it("appends after existing siblings in the same parent", async () => {
    const { db, insertValues } = createFakeDb({
      selectRows: [{ sortOrder: 0 }, { sortOrder: 2 }],
      mutateReturning: [{ id: 3 }],
    });

    await createCategory(db, 7, { name: "Detergents", parentId: 1 });

    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ sortOrder: 3 }),
    );
  });
});

describe("renameCategory", () => {
  it("returns not_found when no row matches", async () => {
    const { db } = createFakeDb({ mutateReturning: [] });

    const result = await renameCategory(db, 7, 99, "New name");

    expect(result).toEqual({ ok: false, reason: "not_found" });
  });

  it("returns the renamed category on success", async () => {
    const row = { id: 1, name: "New name" };
    const { db } = createFakeDb({ mutateReturning: [row] });

    const result = await renameCategory(db, 7, 1, "New name");

    expect(result).toEqual({ ok: true, category: row });
  });
});

describe("archiveCategory", () => {
  it("returns not_found when no row matches", async () => {
    const { db } = createFakeDb({ mutateReturning: [] });

    const result = await archiveCategory(db, 7, 99);

    expect(result).toEqual({ ok: false, reason: "not_found" });
  });
});

describe("reorderCategories", () => {
  it("rejects when the ordered ids don't match the sibling group (cross-parent drop)", async () => {
    const { db } = createFakeDb({ selectRows: [{ id: 1 }, { id: 2 }] });

    // id 99 belongs to a different parent and isn't in this group's sibling set.
    const result = await reorderCategories(db, 7, 5, [1, 99]);

    expect(result).toEqual({ ok: false, reason: "invalid_ids" });
  });

  it("rejects when not all siblings are included", async () => {
    const { db } = createFakeDb({ selectRows: [{ id: 1 }, { id: 2 }] });

    const result = await reorderCategories(db, 7, 5, [1]);

    expect(result).toEqual({ ok: false, reason: "invalid_ids" });
  });

  it("writes sequential sort_order for a valid full reorder", async () => {
    const { db, updateSet } = createFakeDb({
      selectRows: [{ id: 1 }, { id: 2 }, { id: 3 }],
    });

    const result = await reorderCategories(db, 7, 5, [3, 1, 2]);

    expect(result).toEqual({ ok: true });
    expect(updateSet).toHaveBeenCalledWith({ sortOrder: 0 });
    expect(updateSet).toHaveBeenCalledWith({ sortOrder: 1 });
    expect(updateSet).toHaveBeenCalledWith({ sortOrder: 2 });
  });
});
