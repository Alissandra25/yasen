"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { postTransferAction } from "@/server/actions/transfers";

export function TransferForm({
  locations,
  products,
  categories,
  stockByLocation,
}: {
  locations: { id: number; name: string }[];
  products: { id: number; name: string; categoryId: number }[];
  categories: { id: number; label: string }[];
  /** productId -> locationId -> quantity, so the form can show/limit by what's actually there. */
  stockByLocation: [number, [number, number][]][];
}) {
  const t = useTranslations("transfers");

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
  const [selected, setSelected] = useState<Map<number, string>>(new Map());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<"error" | "posted" | null>(null);
  const [errorDetail, setErrorDetail] = useState<{
    productName: string;
    available: number;
  } | null>(null);

  const availableProducts = products.filter((product) => {
    if (categoryFilter && String(product.categoryId) !== categoryFilter) {
      return false;
    }
    const qty = stockMap.get(product.id)?.get(fromLocationId) ?? 0;
    return qty > 0;
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

    setMessage("posted");
    setSelected(new Map());
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border p-4">
      <h3 className="text-sm font-semibold text-foreground">
        {t("newTransferTitle")}
      </h3>

      <div className="flex flex-wrap gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">
            {t("fromLabel")}
          </label>
          <select
            value={fromLocationId}
            onChange={(event) => setFromLocationId(Number(event.target.value))}
            className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground"
          >
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">
            {t("toLabel")}
          </label>
          <select
            value={toLocationId}
            onChange={(event) => setToLocationId(Number(event.target.value))}
            className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground"
          >
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">
            {t("categoryLabel")}
          </label>
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
        </div>
      </div>

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
              className="flex items-center gap-3 rounded-lg border border-border px-3 py-2"
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => toggleSelected(product.id)}
              />
              <span className="flex-1 text-sm text-foreground">
                {product.name}
              </span>
              <span className="text-xs text-muted-foreground">
                {t("availableLabel")}: {available}
              </span>
              {isSelected && (
                <Input
                  className="w-20"
                  inputMode="numeric"
                  value={selected.get(product.id) ?? ""}
                  onChange={(event) =>
                    setQuantity(product.id, event.target.value)
                  }
                />
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

      {message === "error" && (
        <p className="text-sm text-destructive">
          {errorDetail
            ? t("insufficientStockError", {
                product: errorDetail.productName,
                available: errorDetail.available,
              })
            : t("invalidInput")}
        </p>
      )}
      {message === "posted" && (
        <p className="text-sm text-muted-foreground">{t("posted")}</p>
      )}
    </div>
  );
}
