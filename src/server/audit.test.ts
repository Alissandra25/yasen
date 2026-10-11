import { describe, expect, it, vi } from "vitest";
import { auditLogTable } from "@/db/schema/audit-log";
import { recordAuditEntry } from "./audit";

function createFakeDb() {
  const values = vi.fn().mockResolvedValue(undefined);
  const insert = vi.fn().mockReturnValue({ values });
  return {
    db: { insert } as unknown as Parameters<typeof recordAuditEntry>[0],
    insert,
    values,
  };
}

describe("recordAuditEntry", () => {
  it("inserts into audit_log with the given fields", async () => {
    const { db, insert, values } = createFakeDb();

    await recordAuditEntry(db, {
      businessId: 1,
      userId: 2,
      actionType: "sale.create",
      entityType: "sale",
      entityId: 42,
      reason: "correction",
    });

    expect(insert).toHaveBeenCalledWith(auditLogTable);
    expect(values).toHaveBeenCalledWith({
      businessId: 1,
      userId: 2,
      actionType: "sale.create",
      entityType: "sale",
      entityId: 42,
      productId: null,
      oldValue: null,
      newValue: null,
      reason: "correction",
    });
  });

  it("defaults optional fields to null, including a system-triggered entry's userId", async () => {
    const { db, values } = createFakeDb();

    await recordAuditEntry(db, {
      businessId: 1,
      userId: null,
      actionType: "period.autoclose",
      entityType: "period",
    });

    expect(values).toHaveBeenCalledWith({
      businessId: 1,
      userId: null,
      actionType: "period.autoclose",
      entityType: "period",
      entityId: null,
      productId: null,
      oldValue: null,
      newValue: null,
      reason: null,
    });
  });

  it("carries the before/after snapshot for a correction", async () => {
    const { db, values } = createFakeDb();

    await recordAuditEntry(db, {
      businessId: 1,
      userId: 2,
      actionType: "purchase.correct",
      entityType: "purchase",
      entityId: 7,
      oldValue: { quantity: 12 },
      newValue: { quantity: 10 },
      reason: "typo on receipt",
    });

    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        oldValue: { quantity: 12 },
        newValue: { quantity: 10 },
      }),
    );
  });
});
