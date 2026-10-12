"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { StockAdjustRow } from "@/components/stock-adjust-row";
import type { InventoryRow } from "@/server/services/inventory";

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
  const [locationFilter, setLocationFilter] = useState("");

  const visible = inventory.filter((row) => {
    if (categoryFilter && String(row.categoryId) !== categoryFilter) {
      return false;
    }
    if (locationFilter && String(row.locationId) !== locationFilter) {
      return false;
    }
    return true;
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-4">
        <select
          value={categoryFilter}
          onChange={(event) => setCategoryFilter(event.target.value)}
          className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground"
        >
          <option value="">{t("allCategories")}</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.label}
            </option>
          ))}
        </select>
        <select
          value={locationFilter}
          onChange={(event) => setLocationFilter(event.target.value)}
          className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground"
        >
          <option value="">{t("allLocations")}</option>
          {locations.map((location) => (
            <option key={location.id} value={location.id}>
              {location.name}
            </option>
          ))}
        </select>
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-muted-foreground">
            <th className="py-1 pr-4">{t("productColumn")}</th>
            <th className="py-1 pr-4">{t("skuColumn")}</th>
            <th className="py-1 pr-4">{t("locationColumn")}</th>
            <th className="py-1 pr-4 text-right">{t("quantityColumn")}</th>
            <th className="py-1 pr-4" />
          </tr>
        </thead>
        <tbody>
          {visible.map((row) => (
            <StockAdjustRow
              key={`${row.productId}-${row.locationId}`}
              row={row}
            />
          ))}
          {visible.length === 0 && (
            <tr>
              <td colSpan={5} className="py-2 text-sm text-muted-foreground">
                {t("empty")}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
