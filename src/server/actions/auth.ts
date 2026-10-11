"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/db/client";
import { recordAuditEntry } from "@/server/audit";
import {
  changePassword as changePasswordService,
  verifyCredentials,
} from "@/server/services/auth";
import { createSession, destroySession, requireOwner } from "@/server/session";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export interface LoginState {
  error?: "invalid_input" | "invalid_credentials";
}

export async function loginAction(
  locale: string,
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: "invalid_input" };
  }

  const user = await verifyCredentials(
    getDb(),
    parsed.data.email,
    parsed.data.password,
  );
  if (!user) {
    return { error: "invalid_credentials" };
  }

  await createSession(user.id);
  redirect(`/${locale}`);
}

export async function logoutAction(locale: string): Promise<void> {
  await destroySession();
  redirect(`/${locale}/login`);
}

const changePasswordSchema = z.object({
  oldPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

export interface ChangePasswordState {
  error?: "invalid_input" | "wrong_password";
  success?: boolean;
}

export async function changePasswordAction(
  _prevState: ChangePasswordState,
  formData: FormData,
): Promise<ChangePasswordState> {
  const user = await requireOwner();

  const parsed = changePasswordSchema.safeParse({
    oldPassword: formData.get("oldPassword"),
    newPassword: formData.get("newPassword"),
  });
  if (!parsed.success) {
    return { error: "invalid_input" };
  }

  const db = getDb();
  const result = await db.transaction(async (tx) => {
    const outcome = await changePasswordService(
      tx,
      user.id,
      parsed.data.oldPassword,
      parsed.data.newPassword,
    );
    if (outcome.ok) {
      await recordAuditEntry(tx, {
        businessId: user.businessId,
        userId: user.id,
        actionType: "user.change_password",
        entityType: "user",
        entityId: user.id,
      });
    }
    return outcome;
  });

  if (!result.ok) {
    return { error: result.reason };
  }
  return { success: true };
}
