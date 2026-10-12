"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  adjustStockAction,
  type StockAdjustmentFormState,
} from "@/server/actions/stock-adjustments";
import type { InventoryRow } from "@/server/services/inventory";

const initialState: StockAdjustmentFormState = {};

export function StockAdjustRow({ row }: { row: InventoryRow }) {
  const t = useTranslations("stock");
  const [adjusting, setAdjusting] = useState(false);
  const [state, formAction, isPending] = useActionState(
    adjustStockAction,
    initialState,
  );

  return (
    <>
      <tr className="border-t border-border">
        <td className="py-1 pr-4 text-foreground">{row.productName}</td>
        <td className="py-1 pr-4 text-muted-foreground">{row.sku ?? ""}</td>
        <td className="py-1 pr-4 text-foreground">{row.locationName}</td>
        <td
          className={
            row.quantity < 0
              ? "py-1 pr-4 text-right font-medium text-destructive"
              : "py-1 pr-4 text-right text-foreground"
          }
        >
          {row.quantity}
        </td>
        <td className="py-1 pr-4 text-right">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setAdjusting((prev) => !prev)}
          >
            {t("adjust")}
          </Button>
        </td>
      </tr>
      {adjusting && (
        <tr className="border-t border-border bg-muted/40">
          <td colSpan={5} className="px-4 py-2">
            <form
              action={formAction}
              className="flex flex-wrap items-end gap-3"
            >
              <input type="hidden" name="productId" value={row.productId} />
              <input type="hidden" name="locationId" value={row.locationId} />
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground">
                  {t("newQuantityLabel")}
                </label>
                <Input
                  name="newQuantity"
                  className="w-24"
                  defaultValue={row.quantity}
                  inputMode="numeric"
                  required
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground">
                  {t("reasonLabel")}
                </label>
                <select
                  name="reason"
                  defaultValue="other"
                  className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground"
                >
                  <option value="breakage">{t("reason.breakage")}</option>
                  <option value="shortage">{t("reason.shortage")}</option>
                  <option value="mis_sort">{t("reason.mis_sort")}</option>
                  <option value="other">{t("reason.other")}</option>
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
                onClick={() => setAdjusting(false)}
              >
                {t("cancel")}
              </Button>
            </form>
          </td>
        </tr>
      )}
    </>
  );
}
