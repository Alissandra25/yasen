import { describe, expect, it, vi } from "vitest";
import {
  changePassword,
  hashPassword,
  verifyCredentials,
  verifyPassword,
} from "./auth";

function createFakeDb(user?: { id: number; passwordHash: string }) {
  const limit = vi.fn().mockResolvedValue(user ? [user] : []);
  const where = vi.fn().mockReturnValue({ limit });
  const from = vi.fn().mockReturnValue({ where });
  const select = vi.fn().mockReturnValue({ from });

  const updateWhere = vi.fn().mockResolvedValue(undefined);
  const set = vi.fn().mockReturnValue({ where: updateWhere });
  const update = vi.fn().mockReturnValue({ set });

  return {
    db: { select, update } as unknown as Parameters<typeof changePassword>[0],
    select,
    update,
    set,
    updateWhere,
  };
}

describe("hashPassword / verifyPassword", () => {
  it("never stores the plaintext password, but accepts it back", async () => {
    const hash = await hashPassword("correct horse battery staple");

    expect(hash).not.toBe("correct horse battery staple");
    await expect(
      verifyPassword("correct horse battery staple", hash),
    ).resolves.toBe(true);
    await expect(verifyPassword("wrong password", hash)).resolves.toBe(false);
  });
});

describe("verifyCredentials", () => {
  it("returns null when no user matches the email", async () => {
    const { db } = createFakeDb(undefined);

    await expect(
      verifyCredentials(db, "nobody@yasen.com", "anything"),
    ).resolves.toBeNull();
  });

  it("returns null when the password doesn't match", async () => {
    const hash = await hashPassword("right-password");
    const { db } = createFakeDb({ id: 1, passwordHash: hash });

    await expect(
      verifyCredentials(db, "owner@yasen.com", "wrong-password"),
    ).resolves.toBeNull();
  });

  it("returns the user when the password matches", async () => {
    const hash = await hashPassword("right-password");
    const user = { id: 1, passwordHash: hash };
    const { db } = createFakeDb(user);

    await expect(
      verifyCredentials(db, "owner@yasen.com", "right-password"),
    ).resolves.toEqual(user);
  });
});

describe("changePassword", () => {
  it("rejects when the old password is wrong, without writing anything", async () => {
    const hash = await hashPassword("current-password");
    const { db, update } = createFakeDb({ id: 1, passwordHash: hash });

    const result = await changePassword(
      db,
      1,
      "not-the-password",
      "new-password-1",
    );

    expect(result).toEqual({ ok: false, reason: "wrong_password" });
    expect(update).not.toHaveBeenCalled();
  });

  it("hashes and stores the new password when the old one is correct", async () => {
    const hash = await hashPassword("current-password");
    const { db, update, set, updateWhere } = createFakeDb({
      id: 1,
      passwordHash: hash,
    });

    const result = await changePassword(
      db,
      1,
      "current-password",
      "new-password-1",
    );

    expect(result).toEqual({ ok: true });
    expect(update).toHaveBeenCalledOnce();
    expect(updateWhere).toHaveBeenCalledOnce();
    const newHash = set.mock.calls[0][0].passwordHash as string;
    expect(newHash).not.toBe("new-password-1");
    await expect(verifyPassword("new-password-1", newHash)).resolves.toBe(true);
  });
});
