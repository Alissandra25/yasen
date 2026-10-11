import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import type { getDb } from "@/db/client";
import { usersTable } from "@/db/schema/users";

// Readable by either the top-level db or a transaction handle (see src/server/audit.ts).
type ReadableDbOrTx = Pick<ReturnType<typeof getDb>, "select">;
type WritableDbOrTx = Pick<ReturnType<typeof getDb>, "select" | "update">;

const BCRYPT_ROUNDS = 10;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function findUserByEmail(db: ReadableDbOrTx, email: string) {
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email))
    .limit(1);
  return user;
}

/** Returns the user on a matching email + password, otherwise null. Never reveals which part was wrong. */
export async function verifyCredentials(
  db: ReadableDbOrTx,
  email: string,
  password: string,
) {
  const user = await findUserByEmail(db, email);
  if (!user) return null;
  const valid = await verifyPassword(password, user.passwordHash);
  return valid ? user : null;
}

export type ChangePasswordResult =
  { ok: true } | { ok: false; reason: "wrong_password" };

/** Requires the current password to confirm identity before setting a new one. */
export async function changePassword(
  db: WritableDbOrTx,
  userId: number,
  oldPassword: string,
  newPassword: string,
): Promise<ChangePasswordResult> {
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);

  if (!user || !(await verifyPassword(oldPassword, user.passwordHash))) {
    return { ok: false, reason: "wrong_password" };
  }

  const passwordHash = await hashPassword(newPassword);
  await db
    .update(usersTable)
    .set({ passwordHash })
    .where(eq(usersTable.id, userId));

  return { ok: true };
}
