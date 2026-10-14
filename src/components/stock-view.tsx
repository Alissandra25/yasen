"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { StockAdjustCell } from "@/components/stock-adjust-cell";
import { cn } from "@/lib/utils";
import type { InventoryRow } from "@/server/services/inventory";

type QuickFilter = "negative" | "belowMin" | "zero" | null;

const QUICK_FILTER_KEYS = ["negative", "belowMin", "zero"] as const;

interface ProductStockRow {
  productId: number;
  productName: string;
  sku: string | null;
  categoryId: number;
  minStock: number;
  total: number;
  byLocation: Map<number, number>;
}

function StatusBadge({ total, minStock }: { total: number; minStock: number }) {
  const t = useTranslations("stock");
  if (total < 0) {
    return (
      <Badge variant="destructive" className="font-medium">
        {t("statusNegative")}
      </Badge>
    );
  }
  if (total === 0) {
    return (
      <Badge className="bg-warning font-medium text-warning-foreground">
        {t("statusZero")}
      </Badge>
    );
  }
  if (total < minStock) {
    return (
      <Badge className="bg-warning font-medium text-warning-foreground">
        {t("statusBelowMin")}
      </Badge>
    );
  }
  return null;
}

export function StockView({
  inventory,
  categories,
  locations,
}: {
  inventory: InventoryRow[];
  categories: { id: number; label: string }[];
  locations: { id: number; name: string }[];
}) {
  const t = useTranslations("stock");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [quickFilter, setQuickFilter] = useState<QuickFilter>(null);
  const filterLabels: Record<(typeof QUICK_FILTER_KEYS)[number], string> = {
    negative: t("filterNegative"),
    belowMin: t("filterBelowMin"),
    zero: t("filterZero"),
  };

  const products = useMemo(() => {
    const map = new Map<number, ProductStockRow>();
    for (const row of inventory) {
      const existing = map.get(row.productId) ?? {
        productId: row.productId,
        productName: row.productName,
        sku: row.sku,
        categoryId: row.categoryId,
        minStock: row.minStock,
        total: 0,
        byLocation: new Map<number, number>(),
      };
      existing.total += row.quantity;
      existing.byLocation.set(row.locationId, row.quantity);
      map.set(row.productId, existing);
    }
    return Array.from(map.values()).sort((a, b) =>
      a.productName.localeCompare(b.productName),
    );
  }, [inventory]);

  const counts = useMemo(
    () => ({
      negative: products.filter((p) => p.total < 0).length,
      belowMin: products.filter((p) => p.total >= 0 && p.total < p.minStock)
        .length,
      zero: products.filter((p) => p.total === 0).length,
    }),
    [products],
  );

  const visible = products
    .filter((product) => {
      if (categoryFilter && String(product.categoryId) !== categoryFilter) {
        return false;
      }
      return true;
    })
    .filter((product) => {
      if (quickFilter === "negative") return product.total < 0;
      if (quickFilter === "belowMin") {
        return product.total >= 0 && product.total < product.minStock;
      }
      if (quickFilter === "zero") return product.total === 0;
      return true;
    });

  function toggleFilter(filter: QuickFilter) {
    setQuickFilter((prev) => (prev === filter ? null : filter));
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={categoryFilter}
          onChange={(event) => setCategoryFilter(event.target.value)}
          className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
        >
          <option value="">{t("allCategories")}</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.label}
            </option>
          ))}
        </select>
        {QUICK_FILTER_KEYS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => toggleFilter(key)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium transition-colors",
              quickFilter === key
                ? "border-primary bg-primary text-primary-foreground"
                : "border-input text-foreground hover:bg-muted",
            )}
          >
            {filterLabels[key]}
            <span
              className={cn(
                "rounded-full px-1.5 text-xs",
                quickFilter === key
                  ? "bg-primary-foreground/20"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {counts[key]}
            </span>
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted text-left text-muted-foreground">
              <th className="px-3 py-2 font-medium">{t("productColumn")}</th>
              {locations.map((location) => (
                <th
                  key={location.id}
                  className="px-3 py-2 text-right font-medium"
                >
                  {location.name}
                </th>
              ))}
              <th className="px-3 py-2 text-right font-medium">
                {t("totalColumn")}
              </th>
              <th className="px-3 py-2 text-right font-medium">
                {t("minColumn")}
              </th>
              <th className="px-3 py-2 font-medium">{t("statusColumn")}</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((product) => (
              <tr
                key={product.productId}
                className="border-b border-border last:border-b-0 hover:bg-muted/40"
              >
                <td className="px-3 py-2">
                  <div className="font-medium text-foreground">
                    {product.productName}
                  </div>
                  {product.sku && (
                    <div className="text-xs text-muted-foreground">
                      {product.sku}
                    </div>
                  )}
                </td>
                {locations.map((location) => {
                  const quantity = product.byLocation.get(location.id) ?? 0;
                  return (
                    <td key={location.id} className="px-1 py-1 text-right">
                      <StockAdjustCell
                        productId={product.productId}
                        productName={product.productName}
                        locationId={location.id}
                        locationName={location.name}
                        quantity={quantity}
                      />
                    </td>
                  );
                })}
                <td
                  className={cn(
                    "px-3 py-2 text-right font-semibold",
                    product.total < 0 ? "text-destructive" : "text-foreground",
                  )}
                >
                  {product.total}
                </td>
                <td className="px-3 py-2 text-right text-muted-foreground">
                  {product.minStock}
                </td>
                <td className="px-3 py-2">
                  <StatusBadge
                    total={product.total}
                    minStock={product.minStock}
                  />
                </td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td
                  colSpan={locations.length + 4}
                  className="px-3 py-6 text-center text-sm text-muted-foreground"
                >
                  {t("empty")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
