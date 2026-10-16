"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ChevronRight, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { LocationDot } from "@/components/location-dot";
import { formatMoneyBare } from "@/lib/money";
import { formatNumber } from "@/lib/numbers";
import { cn } from "@/lib/utils";
import {
  archiveProductAction,
  bulkSetCategoryAction,
  confirmProductsReviewedAction,
} from "@/server/actions/products";
import type { Product } from "@/server/services/products";

function normalize(value: string) {
  return value.trim().toLowerCase();
}

const PILL_KEYS = ["needsReview", "archiveCandidate", "archived"] as const;

type Pill = "needsReview" | "archiveCandidate" | "archived" | null;

export function ProductList({
  products,
  categoryBreadcrumbs,
  categories,
  suppliers,
  locations,
  prices,
  stockByProduct,
  archiveCandidateIds,
}: {
  products: Product[];
  categoryBreadcrumbs: Map<number, string>;
  categories: { id: number; label: string }[];
  suppliers: { id: number; name: string }[];
  locations: { id: number; name: string; type: "warehouse" | "shop" }[];
  prices: [number, { purchasePrice: number; salePrice: number | null }][];
  stockByProduct: [number, [number, number][]][];
  archiveCandidateIds: number[];
}) {
  const t = useTranslations("products");
  const locale = useLocale();
  const scrollRef = useRef<HTMLDivElement>(null);

  const [categoryFilter, setCategoryFilter] = useState("");
  const [supplierFilter, setSupplierFilter] = useState("");
  const [pill, setPill] = useState<Pill>(null);
  const [search, setSearch] = useState("");
  const [sortDesc, setSortDesc] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkCategoryId, setBulkCategoryId] = useState("");

  const candidateSet = useMemo(
    () => new Set(archiveCandidateIds),
    [archiveCandidateIds],
  );
  const priceMap = useMemo(() => new Map(prices), [prices]);
  const stockMap = useMemo(
    () => new Map(stockByProduct.map(([id, list]) => [id, new Map(list)])),
    [stockByProduct],
  );

  const counts = useMemo(
    () => ({
      needsReview: products.filter((p) => !p.archived && p.needsReview).length,
      archiveCandidate: products.filter(
        (p) => !p.archived && candidateSet.has(p.id),
      ).length,
      archived: products.filter((p) => p.archived).length,
    }),
    [products, candidateSet],
  );

  const searchQuery = normalize(search);
  const visible = products
    .filter((product) => {
      if (pill === "archived") return product.archived;
      if (product.archived) return false;
      if (pill === "needsReview") return product.needsReview;
      if (pill === "archiveCandidate") return candidateSet.has(product.id);
      return true;
    })
    .filter((product) => {
      if (categoryFilter && String(product.categoryId) !== categoryFilter) {
        return false;
      }
      if (
        supplierFilter &&
        String(product.defaultSupplierId ?? "") !== supplierFilter
      ) {
        return false;
      }
      if (searchQuery) {
        const matchesName = normalize(product.name).includes(searchQuery);
        const matchesSku = product.sku
          ? normalize(product.sku).includes(searchQuery)
          : false;
        if (!matchesName && !matchesSku) return false;
      }
      return true;
    })
    .slice()
    .sort((a, b) =>
      sortDesc ? b.name.localeCompare(a.name) : a.name.localeCompare(b.name),
    );

  function toggleSelected(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function confirmSelected() {
    await confirmProductsReviewedAction(Array.from(selected));
    setSelected(new Set());
  }

  async function archiveSelected() {
    await Promise.all(
      Array.from(selected).map((id) => archiveProductAction(id)),
    );
    setSelected(new Set());
  }

  async function applyBulkCategory() {
    if (!bulkCategoryId) return;
    await bulkSetCategoryAction(Array.from(selected), Number(bulkCategoryId));
    setSelected(new Set());
    setBulkCategoryId("");
  }

  const rowVirtualizer = useVirtualizer({
    count: visible.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 48,
    overscan: 24,
  });

  const gridTemplateColumns =
    "32px minmax(220px,1fr) 180px 160px 90px 90px 110px 48px 32px";

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-xs flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            name="products-search"
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
          <option value="">{t("allCategories")}</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.label}
            </option>
          ))}
        </select>
        <select
          value={supplierFilter}
          onChange={(event) => setSupplierFilter(event.target.value)}
          className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
        >
          <option value="">
            {t("supplierLabel")}: {t("allSuppliers")}
          </option>
          {suppliers.map((supplier) => (
            <option key={supplier.id} value={supplier.id}>
              {supplier.name}
            </option>
          ))}
        </select>
        {PILL_KEYS.map((key) => {
          const label =
            key === "needsReview"
              ? t("needsReviewFilter")
              : key === "archiveCandidate"
                ? t("archiveCandidateFilter")
                : t("archivedFilter");
          const count = counts[key];
          return (
            <button
              key={key}
              type="button"
              onClick={() => setPill((prev) => (prev === key ? null : key))}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium transition-colors",
                pill === key
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-input text-foreground hover:bg-muted",
              )}
            >
              {label}
              {key !== "archived" && (
                <span
                  className={cn(
                    "rounded-full px-1.5 text-xs",
                    pill === key
                      ? "bg-primary-foreground/20"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {selected.size > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-accent px-3 py-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-accent-foreground">
              {t("selectedCount", { count: selected.size })}
            </span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void confirmSelected()}
            >
              {t("confirmSelected")}
            </Button>
            <Popover>
              <PopoverTrigger
                render={
                  <Button type="button" size="sm" variant="outline">
                    {t("changeCategoryAction")}
                  </Button>
                }
              />
              <PopoverContent
                align="start"
                className="flex w-64 flex-col gap-2 p-3"
              >
                <select
                  value={bulkCategoryId}
                  onChange={(event) => setBulkCategoryId(event.target.value)}
                  className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground outline-none"
                >
                  <option value="">{t("selectCategory")}</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.label}
                    </option>
                  ))}
                </select>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => void applyBulkCategory()}
                  disabled={!bulkCategoryId}
                >
                  {t("apply")}
                </Button>
              </PopoverContent>
            </Popover>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void archiveSelected()}
            >
              {t("archive")}
            </Button>
          </div>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="text-sm text-accent-foreground underline-offset-2 hover:underline"
          >
            {t("clearSelection")}
          </button>
        </div>
      )}

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
            <div role="columnheader" className="px-3 py-2" />
            <div role="columnheader" className="px-2 py-2">
              <button
                type="button"
                onClick={() => setSortDesc((v) => !v)}
                className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                {t("nameColumn")}
                <ChevronRight
                  className={cn(
                    "size-3 transition-transform",
                    sortDesc ? "-rotate-90" : "rotate-90",
                  )}
                />
              </button>
            </div>
            <div
              role="columnheader"
              className="px-2 py-2 text-left text-sm font-medium text-muted-foreground"
            >
              {t("categoryColumn")}
            </div>
            <div
              role="columnheader"
              className="px-2 py-2 text-left text-sm font-medium text-muted-foreground"
            >
              {t("supplierLabel")}
            </div>
            <div
              role="columnheader"
              className="px-2 py-2 text-right text-sm font-medium text-muted-foreground"
            >
              {t("purchasePriceLabel")}
            </div>
            <div
              role="columnheader"
              className="px-2 py-2 text-right text-sm font-medium text-muted-foreground"
            >
              {t("salePriceLabel")}
            </div>
            <div
              role="columnheader"
              className="px-2 py-2 text-left text-sm font-medium text-muted-foreground"
            >
              {t("stockColumn")}
            </div>
            <div
              role="columnheader"
              className="px-2 py-2 text-right text-sm font-medium text-muted-foreground"
            >
              {t("minStockLabel")}
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
              const price = priceMap.get(product.id);
              const stock = stockMap.get(product.id);
              const isCandidate = candidateSet.has(product.id);
              const supplierName = suppliers.find(
                (s) => s.id === product.defaultSupplierId,
              )?.name;

              return (
                <Link
                  key={product.id}
                  href={`products/${product.id}`}
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
                  <div
                    role="cell"
                    className="px-3 py-2"
                    onClick={(e) => e.preventDefault()}
                  >
                    <input
                      type="checkbox"
                      name={`product-select-${product.id}`}
                      checked={selected.has(product.id)}
                      onChange={() => toggleSelected(product.id)}
                      aria-label={t("selectForBulkAction")}
                      className="size-4 rounded border-input accent-primary"
                    />
                  </div>
                  <div role="cell" className="px-2 py-2">
                    <p className="flex items-center gap-2 font-medium text-foreground">
                      {product.name}
                      {!product.archived && product.needsReview && (
                        <Badge className="bg-warning font-normal text-warning-foreground">
                          {t("needsReviewBadge")}
                        </Badge>
                      )}
                      {!product.archived && isCandidate && (
                        <Badge variant="secondary" className="font-normal">
                          {t("archiveCandidateBadge")}
                        </Badge>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {product.sku}
                    </p>
                  </div>
                  <div
                    role="cell"
                    className="px-2 py-2 text-sm text-muted-foreground"
                  >
                    {categoryBreadcrumbs.get(product.categoryId)}
                  </div>
                  <div
                    role="cell"
                    className="px-2 py-2 text-sm text-muted-foreground"
                  >
                    {supplierName ?? "—"}
                  </div>
                  <div
                    role="cell"
                    className="px-2 py-2 text-right text-sm text-foreground"
                  >
                    {price
                      ? formatMoneyBare(price.purchasePrice, { locale })
                      : "—"}
                  </div>
                  <div
                    role="cell"
                    className="px-2 py-2 text-right text-sm font-semibold text-foreground"
                  >
                    {price?.salePrice != null
                      ? formatMoneyBare(price.salePrice, { locale })
                      : "—"}
                  </div>
                  <div
                    role="cell"
                    className="flex items-center gap-2 px-2 py-2 text-sm"
                  >
                    {locations.map((location) => (
                      <span
                        key={location.id}
                        className="flex items-center gap-1"
                      >
                        <LocationDot type={location.type} />
                        {formatNumber(stock?.get(location.id) ?? 0, locale)}
                      </span>
                    ))}
                  </div>
                  <div
                    role="cell"
                    className="px-2 py-2 text-right text-sm text-muted-foreground"
                  >
                    {formatNumber(product.minStock, locale)}
                  </div>
                  <div
                    role="cell"
                    className="flex justify-end px-2 py-2 text-muted-foreground"
                  >
                    <ChevronRight className="size-4" />
                  </div>
                </Link>
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

      <p className="text-xs text-muted-foreground">{t("scrollCaption")}</p>
    </div>
  );
}
