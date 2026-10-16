"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { ArrowLeftRight, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormErrorBanner } from "@/components/form-error-banner";
import { LocationDot } from "@/components/location-dot";
import { useToast } from "@/components/toast-provider";
import { formatNumber } from "@/lib/numbers";
import { cn } from "@/lib/utils";
import { postTransferAction } from "@/server/actions/transfers";

function normalize(value: string) {
  return value.trim().toLowerCase();
}

export function TransferForm({
  locations,
  products,
  categories,
  stockByLocation,
}: {
  locations: { id: number; name: string; type: "warehouse" | "shop" }[];
  products: {
    id: number;
    name: string;
    sku: string | null;
    categoryId: number;
    minStock: number;
  }[];
  categories: { id: number; label: string }[];
  /** productId -> locationId -> quantity, so the form can show/limit by what's actually there. */
  stockByLocation: [number, [number, number][]][];
}) {
  const t = useTranslations("transfers");
  const locale = useLocale();
  const router = useRouter();
  const { showToast } = useToast();

  const stockMap = useMemo(() => {
    const outer = new Map<number, Map<number, number>>();
    for (const [productId, perLocation] of stockByLocation) {
      outer.set(productId, new Map(perLocation));
    }
    return outer;
  }, [stockByLocation]);

  const [fromLocationId, setFromLocationId] = useState(locations[0]?.id ?? 0);
  const [toLocationId, setToLocationId] = useState(
    locations[1]?.id ?? locations[0]?.id ?? 0,
  );
  const [categoryFilter, setCategoryFilter] = useState("");
  const [search, setSearch] = useState("");
  const [belowMinOnly, setBelowMinOnly] = useState(false);
  const [selectedOnly, setSelectedOnly] = useState(false);
  const [selected, setSelected] = useState<Map<number, string>>(new Map());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<"error" | null>(null);
  const [errorDetail, setErrorDetail] = useState<{
    productName: string;
    available: number;
  } | null>(null);

  function swapDirection() {
    setFromLocationId(toLocationId);
    setToLocationId(fromLocationId);
  }

  const belowMinCount = products.filter((product) => {
    const destinationQty = stockMap.get(product.id)?.get(toLocationId) ?? 0;
    return destinationQty < product.minStock;
  }).length;

  const searchQuery = normalize(search);
  const availableProducts = products.filter((product) => {
    if (categoryFilter && String(product.categoryId) !== categoryFilter) {
      return false;
    }
    if (searchQuery) {
      const matchesName = normalize(product.name).includes(searchQuery);
      const matchesSku = product.sku
        ? normalize(product.sku).includes(searchQuery)
        : false;
      if (!matchesName && !matchesSku) return false;
    }
    const qty = stockMap.get(product.id)?.get(fromLocationId) ?? 0;
    if (qty <= 0) return false;
    if (belowMinOnly) {
      const destinationQty = stockMap.get(product.id)?.get(toLocationId) ?? 0;
      if (destinationQty >= product.minStock) return false;
    }
    if (selectedOnly && !selected.has(product.id)) return false;
    return true;
  });

  function toggleSelected(productId: number) {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.set(productId, "");
      }
      return next;
    });
  }

  function setQuantity(productId: number, value: string) {
    setSelected((prev) => {
      const next = new Map(prev);
      next.set(productId, value);
      return next;
    });
  }

  const categoryLabel = categories.find(
    (category) => String(category.id) === categoryFilter,
  )?.label;

  async function handleSubmit() {
    setIsSubmitting(true);
    setMessage(null);
    setErrorDetail(null);

    const lines = Array.from(selected.entries())
      .map(([productId, raw]) => ({
        productId,
        quantity: Number.parseInt(raw, 10),
      }))
      .filter((line) => Number.isFinite(line.quantity) && line.quantity > 0);

    if (lines.length === 0) {
      setIsSubmitting(false);
      return;
    }

    const result = await postTransferAction({
      fromLocationId,
      toLocationId,
      lines,
    });
    setIsSubmitting(false);

    if (!result.ok) {
      setMessage("error");
      if (result.productId !== undefined) {
        const product = products.find((p) => p.id === result.productId);
        setErrorDetail({
          productName: product?.name ?? "",
          available: result.available ?? 0,
        });
      }
      return;
    }

    showToast({ message: t("posted") });
    router.push("/transfers");
    router.refresh();
  }

  const selectedLines = Array.from(selected.entries());
  const hasOverStockError = selectedLines.some(([productId, raw]) => {
    const quantity = Number.parseInt(raw, 10) || 0;
    const available = stockMap.get(productId)?.get(fromLocationId) ?? 0;
    return quantity > available;
  });

  return (
    <div className="flex flex-col gap-4 pb-20">
      <h1 className="text-2xl font-bold tracking-tight text-foreground">
        {t("newTransferTitle")}
      </h1>

      {message === "error" && (
        <FormErrorBanner
          title={t("invalidInputTitle")}
          description={
            errorDetail
              ? t("insufficientStockError", {
                  product: errorDetail.productName,
                  available: errorDetail.available,
                })
              : t("invalidInput")
          }
        />
      )}

      <div className="flex flex-wrap items-center gap-4 rounded-xl border border-border bg-card p-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">
            {t("fromLabel")}
          </label>
          <div className="relative">
            <LocationDot
              type={
                locations.find((l) => l.id === fromLocationId)?.type ??
                "warehouse"
              }
              className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2"
            />
            <select
              value={fromLocationId}
              onChange={(event) =>
                setFromLocationId(Number(event.target.value))
              }
              className="flex h-9 w-44 items-center rounded-lg border border-input bg-transparent pr-2.5 pl-6 text-sm font-medium text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
            >
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={t("swapDirection")}
          className="mt-5"
          onClick={swapDirection}
        >
          <ArrowLeftRight className="size-4" />
        </Button>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">
            {t("toLabel")}
          </label>
          <div className="relative">
            <LocationDot
              type={
                locations.find((l) => l.id === toLocationId)?.type ??
                "warehouse"
              }
              className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2"
            />
            <select
              value={toLocationId}
              onChange={(event) => setToLocationId(Number(event.target.value))}
              className="flex h-9 w-44 items-center rounded-lg border border-input bg-transparent pr-2.5 pl-6 text-sm font-medium text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
            >
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">{t("directionHint")}</p>
      </div>

      {fromLocationId === toLocationId && (
        <p className="text-sm text-destructive">{t("sameLocationError")}</p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-xs flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("searchPlaceholder")}
            className="h-8 w-full rounded-lg border border-input bg-transparent pr-2 pl-8 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(event) => setCategoryFilter(event.target.value)}
          className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground outline-none"
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
        {categoryLabel && <span className="sr-only">{categoryLabel}</span>}
        <button
          type="button"
          onClick={() => setBelowMinOnly((v) => !v)}
          className={cn(
            "flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium transition-colors",
            belowMinOnly
              ? "border-primary/40 bg-accent text-accent-foreground"
              : "border-border text-muted-foreground hover:text-foreground",
          )}
        >
          {t("belowMinFilter")}
          <span className="rounded-full bg-muted px-1.5 text-xs">
            {belowMinCount}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setSelectedOnly((v) => !v)}
          className={cn(
            "flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium transition-colors",
            selectedOnly
              ? "border-primary/40 bg-accent text-accent-foreground"
              : "border-border text-muted-foreground hover:text-foreground",
          )}
        >
          {t("selectedOnlyFilter")}
          <span className="rounded-full bg-muted px-1.5 text-xs">
            {selected.size}
          </span>
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted text-left text-muted-foreground">
              <th className="w-8 px-3 py-2" />
              <th className="px-2 py-2 font-medium">{t("productColumn")}</th>
              <th className="px-2 py-2 text-right font-medium">
                {t("fromLabel")}
              </th>
              <th className="px-2 py-2 text-right font-medium">
                {t("toLabel")}
              </th>
              <th className="px-2 py-2 text-right font-medium">
                {t("moveColumn")}
              </th>
              <th className="px-2 py-2 font-medium">{t("afterColumn")}</th>
            </tr>
          </thead>
          <tbody>
            {availableProducts.map((product) => {
              const fromQty =
                stockMap.get(product.id)?.get(fromLocationId) ?? 0;
              const toQty = stockMap.get(product.id)?.get(toLocationId) ?? 0;
              const isSelected = selected.has(product.id);
              const raw = selected.get(product.id) ?? "";
              const quantity = Number.parseInt(raw, 10) || 0;
              const overStock = isSelected && quantity > fromQty;

              return (
                <tr
                  key={product.id}
                  className={cn(
                    "border-b border-border last:border-b-0",
                    overStock ? "bg-destructive/10" : "hover:bg-muted/30",
                  )}
                >
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelected(product.id)}
                      className="size-4 rounded border-input accent-primary"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <p className="font-medium text-foreground">
                      {product.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {product.sku}
                    </p>
                  </td>
                  <td className="px-2 py-2 text-right text-foreground">
                    {formatNumber(fromQty, locale)}
                  </td>
                  <td className="px-2 py-2 text-right text-foreground">
                    {formatNumber(toQty, locale)}
                  </td>
                  <td className="px-2 py-2">
                    <div className="flex items-center justify-end gap-1.5">
                      <Input
                        className={cn(
                          "w-16 text-right",
                          overStock && "border-destructive",
                        )}
                        inputMode="numeric"
                        disabled={!isSelected}
                        value={raw}
                        onChange={(event) => {
                          if (!isSelected) toggleSelected(product.id);
                          setQuantity(product.id, event.target.value);
                        }}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (!isSelected) toggleSelected(product.id);
                          setQuantity(product.id, String(fromQty));
                        }}
                      >
                        {t("fillAll")}
                      </Button>
                    </div>
                  </td>
                  <td className="px-2 py-2 text-sm">
                    {overStock ? (
                      <span className="font-medium text-destructive">
                        {t("insufficientStockShort", { available: fromQty })}
                      </span>
                    ) : isSelected && quantity > 0 ? (
                      <span className="text-muted-foreground">
                        {t("afterPreview", {
                          from: formatNumber(fromQty - quantity, locale),
                          to: formatNumber(toQty + quantity, locale),
                        })}
                      </span>
                    ) : null}
                  </td>
                </tr>
              );
            })}
            {availableProducts.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-3 py-6 text-center text-sm text-muted-foreground"
                >
                  {t("noAvailableProducts")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 shadow-[0_-2px_8px_rgba(0,0,0,0.04)]">
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <span>{t("selectedCountFooter", { count: selected.size })}</span>
          {hasOverStockError && (
            <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
              {t("overStockBadge")}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/transfers")}
          >
            {t("cancel")}
          </Button>
          <Button
            type="button"
            disabled={
              isSubmitting ||
              fromLocationId === toLocationId ||
              selected.size === 0 ||
              hasOverStockError
            }
            onClick={() => void handleSubmit()}
          >
            {t("post")}
          </Button>
        </div>
      </div>
    </div>
  );
}
