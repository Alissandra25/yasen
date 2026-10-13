"use client";

import { Fragment, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { recordSalesAction } from "@/server/actions/sales";
import { shiftMonth } from "@/lib/dates";
import type { MatrixCellTotal } from "@/server/services/sales";

type Bucket = "none" | "cash" | "card";

function bucketToPaymentMethod(bucket: Bucket): "cash" | "card" | null {
  return bucket === "none" ? null : bucket;
}

function cellKey(productId: number, day: string, bucket: Bucket) {
  return `${productId}|${day}|${bucket}`;
}

function buildOriginalMap(totals: MatrixCellTotal[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const total of totals) {
    const bucket: Bucket = total.paymentMethod ?? "none";
    map.set(cellKey(total.productId, total.saleDate, bucket), total.quantity);
  }
  return map;
}

export function SalesMatrix({
  month,
  days,
  locations,
  locationId,
  products,
  categoryOrder,
  totals,
  stockAtStart,
  stockNow,
}: {
  month: string;
  days: string[];
  locations: { id: number; name: string }[];
  locationId: number;
  products: { id: number; name: string; categoryId: number }[];
  categoryOrder: { id: number; label: string }[];
  totals: MatrixCellTotal[];
  stockAtStart: [number, number][];
  stockNow: [number, number][];
}) {
  const t = useTranslations("sales");
  const router = useRouter();

  const [splitMode, setSplitMode] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [original, setOriginal] = useState(() => buildOriginalMap(totals));
  const [draft, setDraft] = useState(() => buildOriginalMap(totals));
  const [syncedTotals, setSyncedTotals] = useState(totals);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<"error" | "saved" | null>(null);

  // useState's initial value only applies on mount; after a save calls router.refresh(), the
  // server re-renders this page with fresh totals and pushes a new `totals` prop into this
  // already-mounted component. Adjusting state during render (same escape hatch as
  // category-manager.tsx, not useEffect+setState, per this project's react-hooks/set-state-in-effect
  // rule) picks that up immediately instead of only after a full page reload.
  if (totals !== syncedTotals) {
    setSyncedTotals(totals);
    const fresh = buildOriginalMap(totals);
    setOriginal(fresh);
    setDraft(fresh);
  }

  const stockAtStartMap = useMemo(() => new Map(stockAtStart), [stockAtStart]);
  const stockNowMap = useMemo(() => new Map(stockNow), [stockNow]);

  const visibleProducts = products
    .filter((product) =>
      categoryFilter ? String(product.categoryId) === categoryFilter : true,
    )
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name));

  function getValue(productId: number, day: string, bucket: Bucket) {
    return draft.get(cellKey(productId, day, bucket)) ?? 0;
  }

  function setValue(
    productId: number,
    day: string,
    bucket: Bucket,
    value: number,
  ) {
    setDraft((prev) => {
      const next = new Map(prev);
      next.set(cellKey(productId, day, bucket), value);
      return next;
    });
  }

  function cellTotal(productId: number, day: string) {
    return (
      getValue(productId, day, "none") +
      getValue(productId, day, "cash") +
      getValue(productId, day, "card")
    );
  }

  async function handleSave() {
    setIsSaving(true);
    setMessage(null);

    const entries: {
      productId: number;
      locationId: number;
      quantity: number;
      saleDate: string;
      paymentMethod: "cash" | "card" | null;
      clientUuid: string;
    }[] = [];

    for (const product of products) {
      for (const day of days) {
        const buckets: Bucket[] = splitMode
          ? ["cash", "card"]
          : ["none", "cash", "card"];
        if (!splitMode) {
          // Combine every bucket's original into one total, write the delta under "none".
          const originalTotal =
            (original.get(cellKey(product.id, day, "none")) ?? 0) +
            (original.get(cellKey(product.id, day, "cash")) ?? 0) +
            (original.get(cellKey(product.id, day, "card")) ?? 0);
          const draftTotal = cellTotal(product.id, day);
          const delta = draftTotal - originalTotal;
          if (delta !== 0) {
            entries.push({
              productId: product.id,
              locationId,
              quantity: delta,
              saleDate: day,
              paymentMethod: null,
              clientUuid: crypto.randomUUID(),
            });
          }
          continue;
        }
        for (const bucket of buckets) {
          const originalValue =
            original.get(cellKey(product.id, day, bucket)) ?? 0;
          const draftValue = getValue(product.id, day, bucket);
          const delta = draftValue - originalValue;
          if (delta !== 0) {
            entries.push({
              productId: product.id,
              locationId,
              quantity: delta,
              saleDate: day,
              paymentMethod: bucketToPaymentMethod(bucket),
              clientUuid: crypto.randomUUID(),
            });
          }
        }
      }
    }

    if (entries.length === 0) {
      setIsSaving(false);
      return;
    }

    const result = await recordSalesAction(entries);
    setIsSaving(false);

    if (!result.ok) {
      setMessage("error");
      return;
    }

    setMessage("saved");
    setOriginal(new Map(draft));
    router.refresh();
  }

  const groups =
    categoryFilter === ""
      ? categoryOrder
          .map((category) => ({
            category,
            products: visibleProducts.filter(
              (product) => product.categoryId === category.id,
            ),
          }))
          .filter((group) => group.products.length > 0)
      : [{ category: null, products: visibleProducts }];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={
              <Link
                href={`?month=${shiftMonth(month, -1)}&locationId=${locationId}`}
              />
            }
          >
            {t("prevMonth")}
          </Button>
          <span className="text-sm text-foreground">{month}</span>
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={
              <Link
                href={`?month=${shiftMonth(month, 1)}&locationId=${locationId}`}
              />
            }
          >
            {t("nextMonth")}
          </Button>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={locationId}
            onChange={(event) =>
              router.push(`?month=${month}&locationId=${event.target.value}`)
            }
            className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground"
          >
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name}
              </option>
            ))}
          </select>
          <select
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
            className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground"
          >
            <option value="">{t("allCategories")}</option>
            {categoryOrder.map((category) => (
              <option key={category.id} value={category.id}>
                {category.label}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={splitMode}
              onChange={(event) => setSplitMode(event.target.checked)}
            />
            {t("splitPaymentMethod")}
          </label>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="sticky left-0 bg-card px-2 py-1 text-left text-muted-foreground">
                {t("productColumn")}
              </th>
              <th className="px-2 py-1 text-right text-muted-foreground">
                {t("stockAtStartColumn")}
              </th>
              {days.map((day) => (
                <th
                  key={day}
                  className="px-1 py-1 text-center text-muted-foreground"
                >
                  {day.slice(8, 10)}
                </th>
              ))}
              <th className="px-2 py-1 text-right text-muted-foreground">
                {t("stockNowColumn")}
              </th>
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => (
              <Fragment key={group.category?.id ?? "uncategorized"}>
                {group.category && (
                  <tr key={`cat-${group.category.id}`}>
                    <td
                      colSpan={days.length + 3}
                      className="bg-muted px-2 py-1 font-medium text-foreground"
                    >
                      {group.category.label}
                    </td>
                  </tr>
                )}
                {group.products.map((product) => (
                  <tr key={product.id} className="border-t border-border">
                    <td className="sticky left-0 bg-card px-2 py-1 text-foreground">
                      {product.name}
                    </td>
                    <td className="px-2 py-1 text-right text-muted-foreground">
                      {stockAtStartMap.get(product.id) ?? 0}
                    </td>
                    {days.map((day) =>
                      splitMode ? (
                        <td key={day} className="px-1 py-1">
                          <div className="flex flex-col gap-0.5">
                            <input
                              aria-label={t("cashLabel")}
                              className="h-6 w-10 rounded border border-input bg-transparent text-center text-xs"
                              value={getValue(product.id, day, "cash") || ""}
                              onChange={(event) =>
                                setValue(
                                  product.id,
                                  day,
                                  "cash",
                                  Number.parseInt(event.target.value, 10) || 0,
                                )
                              }
                            />
                            <input
                              aria-label={t("cardLabel")}
                              className="h-6 w-10 rounded border border-input bg-transparent text-center text-xs"
                              value={getValue(product.id, day, "card") || ""}
                              onChange={(event) =>
                                setValue(
                                  product.id,
                                  day,
                                  "card",
                                  Number.parseInt(event.target.value, 10) || 0,
                                )
                              }
                            />
                          </div>
                        </td>
                      ) : (
                        <td key={day} className="px-1 py-1">
                          <input
                            aria-label={t("quantityLabel")}
                            className="h-6 w-10 rounded border border-input bg-transparent text-center text-xs"
                            value={getValue(product.id, day, "none") || ""}
                            onChange={(event) =>
                              setValue(
                                product.id,
                                day,
                                "none",
                                Number.parseInt(event.target.value, 10) || 0,
                              )
                            }
                          />
                        </td>
                      ),
                    )}
                    <td className="px-2 py-1 text-right text-muted-foreground">
                      {stockNowMap.get(product.id) ?? 0}
                    </td>
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-3">
        <Button
          type="button"
          size="sm"
          disabled={isSaving}
          onClick={() => void handleSave()}
        >
          {t("save")}
        </Button>
        {message === "error" && (
          <p className="text-sm text-destructive">{t("noPriceError")}</p>
        )}
        {message === "saved" && (
          <p className="text-sm text-muted-foreground">{t("saved")}</p>
        )}
      </div>
    </div>
  );
}
