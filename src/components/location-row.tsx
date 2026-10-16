"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Store, Warehouse } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatMoneyBare, currencyLabel } from "@/lib/money";
import { cn } from "@/lib/utils";
import {
  updateLocationAction,
  type LocationFormState,
} from "@/server/actions/locations";

const initialState: LocationFormState = {};
const LOCATION_TYPES = ["warehouse", "shop"] as const;

export function LocationRow({
  location,
  positionCount,
  negativeCount,
  purchaseValue,
  currency,
}: {
  location: { id: number; name: string; type: "shop" | "warehouse" };
  positionCount: number;
  negativeCount: number;
  purchaseValue: number;
  currency: string;
}) {
  const t = useTranslations("locations");
  const locale = useLocale();
  const [editing, setEditing] = useState(false);
  const boundAction = updateLocationAction.bind(null, location.id);
  const [state, formAction, isPending] = useActionState(
    boundAction,
    initialState,
  );

  const wasPendingRef = useRef(false);
  useEffect(() => {
    if (wasPendingRef.current && !isPending && !state.error) {
      setEditing(false);
    }
    wasPendingRef.current = isPending;
  }, [isPending, state]);

  const TypeIcon = location.type === "shop" ? Store : Warehouse;

  if (editing) {
    return (
      <li className="rounded-xl border border-border bg-card p-4">
        <form action={formAction} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`name-${location.id}`}>{t("nameLabel")}</Label>
            <Input
              id={`name-${location.id}`}
              name="name"
              defaultValue={location.name}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>{t("typeLabel")}</Label>
            <div className="inline-flex items-center gap-1 rounded-lg bg-muted p-1">
              {LOCATION_TYPES.map((value) => (
                <label
                  key={value}
                  className="has-checked:bg-card has-checked:text-foreground has-checked:shadow-sm flex cursor-pointer items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground"
                >
                  <input
                    type="radio"
                    name="type"
                    value={value}
                    defaultChecked={location.type === value}
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
          <div className="flex items-center gap-2">
            <Button type="submit" size="sm" disabled={isPending}>
              {t("save")}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setEditing(false)}
            >
              {t("cancel")}
            </Button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-lg",
              location.type === "warehouse"
                ? "bg-brand-primary/20 text-brand-primary-foreground"
                : "bg-brand-accent/20 text-brand-accent-foreground",
            )}
          >
            <TypeIcon className="size-5" />
          </span>
          <div>
            <p className="font-medium text-foreground">{location.name}</p>
            <Badge
              className={cn(
                "font-normal",
                location.type === "warehouse"
                  ? "bg-brand-primary/20 text-brand-primary-foreground"
                  : "bg-brand-accent/20 text-brand-accent-foreground",
              )}
            >
              {t(`type.${location.type}`)}
            </Badge>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setEditing(true)}
        >
          {t("edit")}
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-muted px-3 py-2">
          <p className="text-xs text-muted-foreground">{t("positionsLabel")}</p>
          <p className="font-semibold text-foreground">{positionCount}</p>
        </div>
        <div className="rounded-lg bg-muted px-3 py-2">
          <p className="text-xs text-muted-foreground">{t("negativeLabel")}</p>
          <p
            className={cn(
              "font-semibold",
              negativeCount > 0 ? "text-destructive" : "text-foreground",
            )}
          >
            {negativeCount}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="text-muted-foreground">
          {t("purchaseValueLabel")}{" "}
          <span className="font-medium text-foreground">
            {formatMoneyBare(purchaseValue, { locale })}{" "}
            {currencyLabel(currency, locale)}
          </span>
        </span>
        <Link
          href={`stock?locationId=${location.id}`}
          className="text-foreground underline-offset-2 hover:underline"
        >
          {t("viewStockLink")} →
        </Link>
      </div>
    </li>
  );
}
