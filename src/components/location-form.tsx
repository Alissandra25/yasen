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
const LOCATION_TYPES = ["warehouse", "shop"] as const;

export function LocationForm() {
  const t = useTranslations("locations");
  const [state, formAction, isPending] = useActionState(
    createLocationAction,
    initialState,
  );

  return (
    <form
      action={formAction}
      className="flex flex-col gap-3 rounded-xl border border-dashed border-border p-4"
    >
      <h3 className="text-sm font-semibold text-foreground">
        {t("newLocationTitle")}
      </h3>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="name">{t("nameLabel")}</Label>
        <Input
          id="name"
          name="name"
          placeholder={t("namePlaceholder")}
          required
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>{t("typeLabel")}</Label>
        <div className="inline-flex w-fit items-center gap-1 rounded-lg bg-muted p-1">
          {LOCATION_TYPES.map((value, index) => (
            <label
              key={value}
              className="has-checked:bg-card has-checked:text-foreground has-checked:shadow-sm flex cursor-pointer items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground"
            >
              <input
                type="radio"
                name="type"
                value={value}
                defaultChecked={index === 1}
                className="sr-only"
              />
              {t(`type.${value}`)}
            </label>
          ))}
        </div>
      </div>
      {state.error && (
        <p className="text-sm text-destructive" role="alert">
          {t("invalidInput")}
        </p>
      )}
      <Button type="submit" disabled={isPending} className="w-fit">
        {t("add")}
      </Button>
    </form>
  );
}
