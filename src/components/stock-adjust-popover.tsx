"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { LocationDot } from "@/components/location-dot";
import { cn } from "@/lib/utils";
import {
  adjustStockAction,
  type StockAdjustmentFormState,
} from "@/server/actions/stock-adjustments";

const initialState: StockAdjustmentFormState = {};
const REASONS = [
  "mis_sort",
  "shortage",
  "breakage",
  "count_error",
  "other",
] as const;

/**
 * One pencil icon per product row (spec mockup 19), opening a popover with a tab per location —
 * replaces the old per-cell invisible-button pattern (every number was its own clickable
 * target, which read as noise).
 */
export function StockAdjustPopover({
  productId,
  productName,
  locations,
}: {
  productId: number;
  productName: string;
  locations: {
    id: number;
    name: string;
    type: "warehouse" | "shop";
    quantity: number;
  }[];
}) {
  const t = useTranslations("stock");
  const [open, setOpen] = useState(false);
  const [locationId, setLocationId] = useState(locations[0]?.id ?? 0);
  const [reason, setReason] = useState<(typeof REASONS)[number] | null>(null);
  const [newQuantity, setNewQuantity] = useState("");
  const [comment, setComment] = useState("");
  const [state, formAction, isPending] = useActionState(
    adjustStockAction,
    initialState,
  );

  const wasPendingRef = useRef(false);
  useEffect(() => {
    if (wasPendingRef.current && !isPending && !state.error) {
      setOpen(false);
    }
    wasPendingRef.current = isPending;
  }, [isPending, state]);

  const currentLocation = locations.find((l) => l.id === locationId);
  const quantity = currentLocation?.quantity ?? 0;
  const parsedNewQuantity = Number.parseInt(newQuantity, 10);
  const difference = Number.isFinite(parsedNewQuantity)
    ? parsedNewQuantity - quantity
    : null;

  function resetForLocation(nextLocationId: number) {
    setLocationId(nextLocationId);
    const found = locations.find((l) => l.id === nextLocationId);
    setNewQuantity(String(found?.quantity ?? 0));
    setReason(null);
    setComment("");
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) resetForLocation(locations[0]?.id ?? 0);
      }}
    >
      <PopoverTrigger
        render={
          <button
            type="button"
            aria-label={`${t("adjust")}: ${productName}`}
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <Pencil className="size-3.5" />
          </button>
        }
      />
      <PopoverContent align="end" className="w-96 p-4">
        <form action={formAction} className="flex flex-col gap-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                {t("adjust")}
              </p>
              <p className="font-semibold text-foreground">{productName}</p>
            </div>
            <PopoverClose
              aria-label={t("cancel")}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" />
            </PopoverClose>
          </div>

          <input type="hidden" name="productId" value={productId} />
          <input type="hidden" name="locationId" value={locationId} />

          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-muted-foreground">
              {t("whereLabel")}
            </span>
            <div className="inline-flex items-center gap-1 rounded-lg bg-muted p-1">
              {locations.map((location) => (
                <button
                  key={location.id}
                  type="button"
                  onClick={() => resetForLocation(location.id)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors",
                    locationId === location.id
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <LocationDot type={location.type} />
                  {location.name} · {location.quantity}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 items-end gap-3">
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">
                {t("inSystemLabel")}
              </span>
              <span
                className={cn(
                  "text-lg font-bold",
                  quantity < 0 ? "text-destructive" : "text-foreground",
                )}
              >
                {quantity}
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <label
                htmlFor={`new-quantity-${productId}`}
                className="text-xs text-muted-foreground"
              >
                {t("newQuantityLabel")}
              </label>
              <Input
                id={`new-quantity-${productId}`}
                name="newQuantity"
                className="text-center text-lg font-bold"
                value={newQuantity}
                onChange={(event) => setNewQuantity(event.target.value)}
                inputMode="numeric"
                required
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">
                {t("differenceLabel")}
              </span>
              <span
                className={cn(
                  "text-lg font-bold",
                  difference === null
                    ? "text-muted-foreground"
                    : difference > 0
                      ? "text-success"
                      : difference < 0
                        ? "text-destructive"
                        : "text-muted-foreground",
                )}
              >
                {difference !== null && difference > 0 ? "+" : ""}
                {difference ?? "—"}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-muted-foreground">
              {t("reasonLabel")}
            </span>
            <div className="flex flex-wrap gap-1.5">
              {REASONS.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setReason(value)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-sm font-medium transition-colors",
                    reason === value
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input text-foreground hover:bg-muted",
                  )}
                >
                  {t(`reason.${value}`)}
                </button>
              ))}
            </div>
            <input type="hidden" name="reason" value={reason ?? ""} />
          </div>

          <div className="flex flex-col gap-1">
            <label
              htmlFor={`comment-${productId}`}
              className="text-xs text-muted-foreground"
            >
              {t("commentLabel")}
            </label>
            <Input
              id={`comment-${productId}`}
              name="comment"
              value={comment}
              onChange={(event) => setComment(event.target.value)}
            />
          </div>

          {state.error && (
            <p className="text-sm text-destructive" role="alert">
              {t("invalidInput")}
            </p>
          )}

          <div className="flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setOpen(false)}
            >
              {t("cancel")}
            </Button>
            <Button type="submit" size="sm" disabled={isPending || !reason}>
              {t("save")}
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}
