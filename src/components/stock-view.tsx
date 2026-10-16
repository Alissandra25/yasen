"use client";

import { useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { LocationDot } from "@/components/location-dot";
import { StockAdjustPopover } from "@/components/stock-adjust-popover";
import { formatNumber } from "@/lib/numbers";
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
      <Badge variant="outline" className="font-medium">
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

function normalize(value: string) {
  return value.trim().toLowerCase();
}

export function StockView({
  inventory,
  categories,
  locations,
}: {
  inventory: InventoryRow[];
  categories: { id: number; label: string }[];
  locations: { id: number; name: string; type: "warehouse" | "shop" }[];
}) {
  const t = useTranslations("stock");
  const locale = useLocale();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [search, setSearch] = useState("");
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

  // "Нижче мінімуму" and "Нулі" used to overlap (a zero-stock product is always "below its
  // minimum" too) — these are mutually exclusive buckets instead: zero is its own status, below
  // minimum means positive stock that still hasn't reached it.
  const counts = useMemo(
    () => ({
      negative: products.filter((p) => p.total < 0).length,
      belowMin: products.filter((p) => p.total > 0 && p.total < p.minStock)
        .length,
      zero: products.filter((p) => p.total === 0).length,
    }),
    [products],
  );

  const searchQuery = normalize(search);
  const visible = products
    .filter((product) => {
      if (categoryFilter && String(product.categoryId) !== categoryFilter) {
        return false;
      }
      if (searchQuery) {
        const matchesName = normalize(product.productName).includes(
          searchQuery,
        );
        const matchesSku = product.sku
          ? normalize(product.sku).includes(searchQuery)
          : false;
        if (!matchesName && !matchesSku) return false;
      }
      return true;
    })
    .filter((product) => {
      if (quickFilter === "negative") return product.total < 0;
      if (quickFilter === "belowMin") {
        return product.total > 0 && product.total < product.minStock;
      }
      if (quickFilter === "zero") return product.total === 0;
      return true;
    });

  function toggleFilter(filter: QuickFilter) {
    setQuickFilter((prev) => (prev === filter ? null : filter));
  }

  const gridTemplateColumns = [
    "minmax(220px,1fr)",
    ...locations.map(() => "84px"),
    "84px",
    "64px",
    "minmax(140px,auto)",
    "44px",
  ].join(" ");

  const rowVirtualizer = useVirtualizer({
    count: visible.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 44,
    overscan: 24,
  });

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-xs flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            name="stock-search"
            autoComplete="off"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("searchPlaceholder")}
            className="h-8 w-full rounded-lg border border-input bg-transparent pr-2 pl-8 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(event) => setCategoryFilter(event.target.value)}
          className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
        >
          <option value="">
            {t("categoryLabel")}: {t("allCategories")}
          </option>
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

      <div
        ref={scrollRef}
        role="table"
        className="relative min-h-0 flex-1 overflow-auto rounded-xl border border-border"
      >
        <div style={{ minWidth: "100%" }}>
          <div
            role="row"
            className="sticky top-0 z-20 grid border-b border-border bg-card"
            style={{ gridTemplateColumns }}
          >
            <div
              role="columnheader"
              className="px-3 py-2 text-left text-sm font-medium text-muted-foreground"
            >
              {t("productColumn")}
            </div>
            {locations.map((location) => (
              <div
                key={location.id}
                role="columnheader"
                className="flex items-center justify-end gap-1.5 px-2 py-2 text-right text-sm font-medium text-muted-foreground"
              >
                <LocationDot type={location.type} />
                {location.name}
              </div>
            ))}
            <div
              role="columnheader"
              className="px-2 py-2 text-right text-sm font-medium text-muted-foreground"
            >
              {t("totalColumn")}
            </div>
            <div
              role="columnheader"
              className="px-2 py-2 text-right text-sm font-medium text-muted-foreground"
            >
              {t("minColumn")}
            </div>
            <div
              role="columnheader"
              className="px-2 py-2 text-left text-sm font-medium text-muted-foreground"
            >
              {t("statusColumn")}
            </div>
            <div role="columnheader" />
          </div>

          <div
            role="rowgroup"
            style={{
              height: rowVirtualizer.getTotalSize(),
              position: "relative",
            }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const product = visible[virtualRow.index];
              return (
                <div
                  key={product.productId}
                  data-index={virtualRow.index}
                  ref={rowVirtualizer.measureElement}
                  role="row"
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    transform: `translateY(${virtualRow.start}px)`,
                    display: "grid",
                    gridTemplateColumns,
                  }}
                  className="items-center border-b border-border bg-card hover:bg-muted/30"
                >
                  <div role="cell" className="px-3 py-2">
                    <p className="font-medium text-foreground">
                      {product.productName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {product.sku}
                    </p>
                  </div>
                  {locations.map((location) => {
                    const quantity = product.byLocation.get(location.id) ?? 0;
                    return (
                      <div
                        key={location.id}
                        role="cell"
                        className={cn(
                          "px-2 py-2 text-right",
                          quantity < 0
                            ? "font-semibold text-destructive"
                            : quantity === 0
                              ? "text-muted-foreground"
                              : "text-foreground",
                        )}
                      >
                        {formatNumber(quantity, locale)}
                      </div>
                    );
                  })}
                  <div
                    role="cell"
                    className={cn(
                      "px-2 py-2 text-right font-semibold",
                      product.total < 0
                        ? "text-destructive"
                        : "text-foreground",
                    )}
                  >
                    {formatNumber(product.total, locale)}
                  </div>
                  <div
                    role="cell"
                    className="px-2 py-2 text-right text-muted-foreground"
                  >
                    {formatNumber(product.minStock, locale)}
                  </div>
                  <div role="cell" className="px-2 py-2">
                    <StatusBadge
                      total={product.total}
                      minStock={product.minStock}
                    />
                  </div>
                  <div role="cell" className="flex justify-end px-2 py-2">
                    <StockAdjustPopover
                      productId={product.productId}
                      productName={product.productName}
                      locations={locations.map((location) => ({
                        id: location.id,
                        name: location.name,
                        type: location.type,
                        quantity: product.byLocation.get(location.id) ?? 0,
                      }))}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {visible.length === 0 && (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">
            {t("empty")}
          </p>
        )}
      </div>
    </div>
  );
}
