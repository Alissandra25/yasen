import type { getDb } from "@/db/client";
import { auditLogTable } from "@/db/schema/audit-log";

// Accepts either the top-level db client or a transaction handle, so callers can write the audit
// entry in the same transaction as the change it describes (see .claude/skills/add-feature).
type DbOrTx = Pick<ReturnType<typeof getDb>, "insert">;

export interface AuditEntry {
  businessId: number;
  // null for system-triggered entries (e.g. automatic month close), not a user action.
  userId: number | null;
  actionType: string;
  entityType: string;
  entityId?: number | null;
  productId?: number | null;
  oldValue?: unknown;
  newValue?: unknown;
  reason?: string | null;
}

/** Records one audit log entry: who, when, what changed, from what to what, and why. */
export async function recordAuditEntry(
  db: DbOrTx,
  entry: AuditEntry,
): Promise<void> {
  await db.insert(auditLogTable).values({
    businessId: entry.businessId,
    userId: entry.userId,
    actionType: entry.actionType,
    entityType: entry.entityType,
    entityId: entry.entityId ?? null,
    productId: entry.productId ?? null,
    oldValue: entry.oldValue ?? null,
    newValue: entry.newValue ?? null,
    reason: entry.reason ?? null,
  });
}
