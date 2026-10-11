import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { sessionsTable } from "@/db/schema/sessions";
import { usersTable } from "@/db/schema/users";

const SESSION_COOKIE = "yasen_session";

// Spec 9 calls for "1-2 weeks, extended on activity". This is a fixed 14-day lifetime without
// sliding extension: Next.js only allows writing cookies from a Server Action or Route Handler,
// never from the Server Components that read the session on most page loads, so a true sliding
// window needs a middleware-level refresh. Deliberate stage-1 simplification — the owner re-logs
// in every two weeks; revisit with a proxy.ts refresh if that's annoying in practice.
const SESSION_LIFETIME_MS = 14 * 24 * 60 * 60 * 1000;

function generateSessionId(): string {
  return randomBytes(32).toString("base64url");
}

export async function createSession(userId: number): Promise<void> {
  const id = generateSessionId();
  const expiresAt = new Date(Date.now() + SESSION_LIFETIME_MS);
  await getDb().insert(sessionsTable).values({ id, userId, expiresAt });

  const store = await cookies();
  store.set(SESSION_COOKIE, id, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const id = store.get(SESSION_COOKIE)?.value;
  if (id) {
    await getDb().delete(sessionsTable).where(eq(sessionsTable.id, id));
  }
  store.delete(SESSION_COOKIE);
}

export interface SessionUser {
  id: number;
  businessId: number;
  email: string;
  role: "owner" | "seller";
}

/** Read-only: safe to call from Server Components, layouts and Server Actions alike. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const id = store.get(SESSION_COOKIE)?.value;
  if (!id) return null;

  const db = getDb();
  const [row] = await db
    .select({
      sessionExpiresAt: sessionsTable.expiresAt,
      userId: usersTable.id,
      businessId: usersTable.businessId,
      email: usersTable.email,
      role: usersTable.role,
    })
    .from(sessionsTable)
    .innerJoin(usersTable, eq(sessionsTable.userId, usersTable.id))
    .where(eq(sessionsTable.id, id))
    .limit(1);

  if (!row || row.sessionExpiresAt.getTime() < Date.now()) {
    if (row) {
      await db.delete(sessionsTable).where(eq(sessionsTable.id, id));
    }
    return null;
  }

  return {
    id: row.userId,
    businessId: row.businessId,
    email: row.email,
    role: row.role,
  };
}

export class UnauthorizedError extends Error {
  constructor() {
    super("Not authorized");
  }
}

/**
 * Only "owner" is reachable at launch (spec 2). This doubles as the permission check every
 * server action needs per CLAUDE.md's "Server" rule — call it first, before Zod validation.
 */
export async function requireOwner(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user || user.role !== "owner") {
    throw new UnauthorizedError();
  }
  return user;
}
