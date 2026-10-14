"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Store, Warehouse } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  updateLocationAction,
  type LocationFormState,
} from "@/server/actions/locations";

const initialState: LocationFormState = {};

export function LocationRow({
  location,
  positionCount,
  negativeCount,
}: {
  location: { id: number; name: string; type: "shop" | "warehouse" };
  positionCount: number;
  negativeCount: number;
}) {
  const t = useTranslations("locations");
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

  if (!editing) {
    const TypeIcon = location.type === "shop" ? Store : Warehouse;
    return (
      <li className="flex items-center justify-between gap-4 rounded-lg border border-border bg-card px-3 py-2">
        <div className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-lg bg-muted">
            <TypeIcon className="size-4 text-muted-foreground" />
          </span>
          <div>
            <p className="text-sm font-medium text-foreground">
              {location.name}
            </p>
            <Badge variant="outline" className="font-normal">
              {t(`type.${location.type}`)}
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <div className="text-right">
            <p className="text-xs text-muted-foreground">
              {t("positionsLabel")}
            </p>
            <p className="font-semibold text-foreground">{positionCount}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">
              {t("negativeLabel")}
            </p>
            <p
              className={
                negativeCount > 0
                  ? "font-semibold text-destructive"
                  : "font-semibold text-foreground"
              }
            >
              {negativeCount}
            </p>
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
      </li>
    );
  }

  return (
    <li className="rounded-lg border border-border bg-card px-3 py-2">
      <form action={formAction} className="flex flex-wrap items-end gap-3">
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
          <Label htmlFor={`type-${location.id}`}>{t("typeLabel")}</Label>
          <select
            id={`type-${location.id}`}
            name="type"
            defaultValue={location.type}
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
      </form>
    </li>
  );
}
