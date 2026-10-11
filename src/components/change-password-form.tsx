"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  changePasswordAction,
  type ChangePasswordState,
} from "@/server/actions/auth";

const initialState: ChangePasswordState = {};

export function ChangePasswordForm() {
  const t = useTranslations("settings");
  const [state, formAction, isPending] = useActionState(
    changePasswordAction,
    initialState,
  );

  return (
    <form action={formAction} className="flex max-w-sm flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="oldPassword">{t("oldPasswordLabel")}</Label>
        <Input
          id="oldPassword"
          name="oldPassword"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="newPassword">{t("newPasswordLabel")}</Label>
        <Input
          id="newPassword"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
      </div>
      {state.error && (
        <p className="text-sm text-destructive" role="alert">
          {t(
            state.error === "invalid_input" ? "invalidInput" : "wrongPassword",
          )}
        </p>
      )}
      {state.success && (
        <p className="text-sm text-muted-foreground" role="status">
          {t("success")}
        </p>
      )}
      <Button type="submit" disabled={isPending}>
        {t("submit")}
      </Button>
    </form>
  );
}
