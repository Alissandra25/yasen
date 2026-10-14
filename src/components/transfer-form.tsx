"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowLeftRight, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormErrorBanner } from "@/components/form-error-banner";
import { useToast } from "@/components/toast-provider";
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
  locations: { id: number; name: string }[];
  products: {
    id: number;
    name: string;
    categoryId: number;
    minStock: number;
  }[];
  categories: { id: number; label: string }[];
  /** productId -> locationId -> quantity, so the form can show/limit by what's actually there. */
  stockByLocation: [number, [number, number][]][];
}) {
  const t = useTranslations("transfers");
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
  const [selected, setSelected] = useState<Map<number, string>>(new Map());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<"error" | "posted" | null>(null);
  const [errorDetail, setErrorDetail] = useState<{
    productName: string;
    available: number;
  } | null>(null);

  function swapDirection() {
    setFromLocationId(toLocationId);
    setToLocationId(fromLocationId);
  }

  const searchQuery = normalize(search);
  const availableProducts = products.filter((product) => {
    if (categoryFilter && String(product.categoryId) !== categoryFilter) {
      return false;
    }
    if (searchQuery && !normalize(product.name).includes(searchQuery)) {
      return false;
    }
    const qty = stockMap.get(product.id)?.get(fromLocationId) ?? 0;
    if (qty <= 0) return false;
    if (belowMinOnly) {
      const destinationQty = stockMap.get(product.id)?.get(toLocationId) ?? 0;
      if (destinationQty >= product.minStock) return false;
    }
    return true;
  });

  function toggleSelected(productId: number) {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.set(productId, "1");
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
    setSelected(new Map());
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4">
      <h3 className="font-semibold text-foreground">{t("newTransferTitle")}</h3>

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

      <div className="flex flex-wrap gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">
            {t("fromLabel")}
          </label>
          <select
            value={fromLocationId}
            onChange={(event) => setFromLocationId(Number(event.target.value))}
            className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name}
              </option>
            ))}
          </select>
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
          <select
            value={toLocationId}
            onChange={(event) => setToLocationId(Number(event.target.value))}
            className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name}
              </option>
            ))}
          </select>
        </div>
        <div className="relative flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">
            {t("searchPlaceholder")}
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("searchPlaceholder")}
              className="h-8 w-48 rounded-lg border border-input bg-transparent pr-2 pl-8 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
            />
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">
            {t("categoryLabel")}
          </label>
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
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        <input
          type="checkbox"
          checked={belowMinOnly}
          onChange={(event) => setBelowMinOnly(event.target.checked)}
          className="size-4 rounded border-input accent-primary"
        />
        {t("belowMinFilter")}
      </label>

      {fromLocationId === toLocationId && (
        <p className="text-sm text-destructive">{t("sameLocationError")}</p>
      )}

      <ul className="flex flex-col gap-2">
        {availableProducts.map((product) => {
          const available = stockMap.get(product.id)?.get(fromLocationId) ?? 0;
          const isSelected = selected.has(product.id);
          return (
            <li
              key={product.id}
              className="flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-2 has-[input:checked]:border-primary/40 has-[input:checked]:bg-accent/40"
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => toggleSelected(product.id)}
                className="size-4 rounded border-input accent-primary"
              />
              <span className="flex-1 text-sm text-foreground">
                {product.name}
              </span>
              <span className="text-xs text-muted-foreground">
                {t("availableLabel")}: {available}
              </span>
              {isSelected && (
                <>
                  <Input
                    className="w-20"
                    inputMode="numeric"
                    value={selected.get(product.id) ?? ""}
                    onChange={(event) =>
                      setQuantity(product.id, event.target.value)
                    }
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setQuantity(product.id, String(available))}
                  >
                    {t("fillAll")}
                  </Button>
                </>
              )}
            </li>
          );
        })}
        {availableProducts.length === 0 && (
          <li className="text-sm text-muted-foreground">
            {t("noAvailableProducts")}
          </li>
        )}
      </ul>

      <div className="flex items-center gap-3">
        <Button
          type="button"
          size="sm"
          disabled={isSubmitting || fromLocationId === toLocationId}
          onClick={() => void handleSubmit()}
        >
          {t("post")}
        </Button>
      </div>
    </div>
  );
}
