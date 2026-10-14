"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginAction, type LoginState } from "@/server/actions/auth";

const initialState: LoginState = {};

export function LoginForm({ locale }: { locale: string }) {
  const t = useTranslations("login");
  const boundLoginAction = loginAction.bind(null, locale);
  const [state, formAction, isPending] = useActionState(
    boundLoginAction,
    initialState,
  );

  return (
    <form action={formAction} className="flex w-full flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">{t("emailLabel")}</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">{t("passwordLabel")}</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>
      {state.error && (
        <p className="text-sm text-destructive" role="alert">
          {t(
            state.error === "invalid_input"
              ? "invalidInput"
              : "invalidCredentials",
          )}
        </p>
      )}
      <Button type="submit" disabled={isPending} className="w-full">
        {t("submit")}
      </Button>
    </form>
  );
}
