"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createLocationAction,
  type LocationFormState,
} from "@/server/actions/locations";

const initialState: LocationFormState = {};

export function LocationForm() {
  const t = useTranslations("locations");
  const [state, formAction, isPending] = useActionState(
    createLocationAction,
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
        <Label htmlFor="type">{t("typeLabel")}</Label>
        <select
          id="type"
          name="type"
          defaultValue="shop"
          className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
        >
          <option value="shop">{t("type.shop")}</option>
          <option value="warehouse">{t("type.warehouse")}</option>
        </select>
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
