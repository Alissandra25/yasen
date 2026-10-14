"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  adjustStockAction,
  type StockAdjustmentFormState,
} from "@/server/actions/stock-adjustments";

const initialState: StockAdjustmentFormState = {};
const REASONS = ["breakage", "shortage", "mis_sort", "other"] as const;

/**
 * One location's quantity for one product, shown as a clickable cell that opens the adjustment
 * popover (spec 4.1) — reused across every location column in the pivoted stock table.
 */
export function StockAdjustCell({
  productId,
  productName,
  locationId,
  locationName,
  quantity,
}: {
  productId: number;
  productName: string;
  locationId: number;
  locationName: string;
  quantity: number;
}) {
  const t = useTranslations("stock");
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<(typeof REASONS)[number]>("other");
  const [newQuantity, setNewQuantity] = useState(String(quantity));
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

  const parsedNewQuantity = Number.parseInt(newQuantity, 10);
  const difference = Number.isFinite(parsedNewQuantity)
    ? parsedNewQuantity - quantity
    : null;

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setNewQuantity(String(quantity));
      }}
    >
      <PopoverTrigger
        render={
          <button
            type="button"
            aria-label={`${t("adjust")}: ${productName}, ${locationName}`}
            className={cn(
              "w-full rounded-md px-2 py-1 text-right hover:bg-muted",
              quantity < 0
                ? "font-semibold text-destructive"
                : quantity === 0
                  ? "text-muted-foreground"
                  : "text-foreground",
            )}
          >
            {quantity}
          </button>
        }
      />
      <PopoverContent align="end" className="w-80 p-4">
        <form action={formAction} className="flex flex-col gap-4">
          <div>
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {t("adjust")}
            </p>
            <p className="font-semibold text-foreground">{productName}</p>
            <p className="text-xs text-muted-foreground">{locationName}</p>
          </div>
          <input type="hidden" name="productId" value={productId} />
          <input type="hidden" name="locationId" value={locationId} />

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
                htmlFor={`new-quantity-${productId}-${locationId}`}
                className="text-xs text-muted-foreground"
              >
                {t("newQuantityLabel")}
              </label>
              <Input
                id={`new-quantity-${productId}-${locationId}`}
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
            <input type="hidden" name="reason" value={reason} />
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
              onClick={() => setOpen(false)}
            >
              {t("cancel")}
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}
