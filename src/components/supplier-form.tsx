"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createSupplierAction,
  type SupplierFormState,
} from "@/server/actions/suppliers";

const initialState: SupplierFormState = {};

export function SupplierForm() {
  const t = useTranslations("suppliers");
  const [state, formAction, isPending] = useActionState(
    createSupplierAction,
    initialState,
  );

  return (
    <form
      action={formAction}
      className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4"
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="name">{t("nameLabel")}</Label>
        <Input id="name" name="name" required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="contacts">{t("contactsLabel")}</Label>
        <Input id="contacts" name="contacts" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="note">{t("noteLabel")}</Label>
        <Input id="note" name="note" />
      </div>
      {state.error && (
        <p className="text-sm text-destructive" role="alert">
          {t("invalidInput")}
        </p>
      )}
      <Button type="submit" disabled={isPending}>
        {t("add")}
      </Button>
    </form>
  );
}
