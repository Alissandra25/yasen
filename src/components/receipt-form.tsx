"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Plus, Split, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormErrorBanner } from "@/components/form-error-banner";
import { LocationDot } from "@/components/location-dot";
import { useToast } from "@/components/toast-provider";
import { currencyLabel, formatMoneyBare } from "@/lib/money";
import { formatNumber } from "@/lib/numbers";
import { cn } from "@/lib/utils";
import {
  postPurchaseAction,
  type PostPurchaseActionInput,
} from "@/server/actions/purchases";

interface DraftLine {
  key: string;
  productId: number | "new";
  newProductName: string;
  newProductCategoryId: number | "";
  newProductSku: string;
  locationId: number;
  quantity: string;
  purchasePriceRaw: string;
  salePriceRaw: string;
  selected: boolean;
  splitParentKey: string | null;
}

let nextKey = 1;
function makeKey() {
  return `line-${nextKey++}`;
}

function emptyLine(defaultLocationId: number): DraftLine {
  return {
    key: makeKey(),
    productId: "new",
    newProductName: "",
    newProductCategoryId: "",
    newProductSku: "",
    locationId: defaultLocationId,
    quantity: "",
    purchasePriceRaw: "",
    salePriceRaw: "",
    selected: false,
    splitParentKey: null,
  };
}

function parseMoneyLoose(raw: string): number | null {
  const normalised = raw.trim().replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(normalised)) return null;
  return Math.round(Number(normalised) * 100);
}

function startingMinStock(quantity: number): number {
  return Math.max(1, Math.ceil(quantity * 0.1));
}

export function ReceiptForm({
  suppliers,
  locations,
  products,
  categories,
  stockByProduct,
  currentPrices,
  today,
  currency,
  locale,
  initialSupplierId,
}: {
  suppliers: { id: number; name: string }[];
  locations: { id: number; name: string; type: "warehouse" | "shop" }[];
  products: { id: number; name: string; sku: string | null }[];
  categories: { id: number; label: string }[];
  stockByProduct: [number, [number, string][]][];
  currentPrices: [
    number,
    { purchasePrice: number; salePrice: number | null },
  ][];
  today: string;
  currency: string;
  locale: string;
  initialSupplierId?: number | null;
}) {
  const t = useTranslations("receipts");
  const router = useRouter();
  const { showToast } = useToast();
  const defaultLocationId = locations[0]?.id ?? 0;

  const stockMap = useMemo(() => new Map(stockByProduct), [stockByProduct]);
  const priceMap = useMemo(() => new Map(currentPrices), [currentPrices]);
  const productMap = useMemo(
    () => new Map(products.map((p) => [p.id, p])),
    [products],
  );

  const [supplierId, setSupplierId] = useState<number | "">(
    initialSupplierId ?? "",
  );
  const [newSupplierName, setNewSupplierName] = useState("");
  const [receivedDate, setReceivedDate] = useState(today);
  const [formDefaultLocationId, setFormDefaultLocationId] =
    useState(defaultLocationId);
  const [lines, setLines] = useState<DraftLine[]>([
    emptyLine(defaultLocationId),
  ]);
  const [bulkLocationId, setBulkLocationId] = useState(defaultLocationId);
  const [addQuery, setAddQuery] = useState("");
  const [highlightIndex, setHighlightIndex] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  function updateLine(key: string, patch: Partial<DraftLine>) {
    setLines((prev) =>
      prev.map((line) => (line.key === key ? { ...line, ...patch } : line)),
    );
  }

  function parentOf(line: DraftLine): DraftLine | null {
    if (!line.splitParentKey) return null;
    return lines.find((l) => l.key === line.splitParentKey) ?? null;
  }

  function effectiveLine(line: DraftLine): DraftLine {
    const parent = parentOf(line);
    if (!parent) return line;
    return {
      ...line,
      productId: parent.productId,
      newProductName: parent.newProductName,
      newProductCategoryId: parent.newProductCategoryId,
      newProductSku: parent.newProductSku,
      purchasePriceRaw: parent.purchasePriceRaw,
      salePriceRaw: parent.salePriceRaw,
    };
  }

  function addProductLine(productId: number | "new", name?: string) {
    const line = emptyLine(formDefaultLocationId);
    line.productId = productId;
    if (productId === "new" && name) line.newProductName = name;
    setLines((prev) => [...prev, line]);
    setAddQuery("");
  }

  function removeLine(key: string) {
    setLines((prev) =>
      prev.filter((line) => line.key !== key && line.splitParentKey !== key),
    );
  }

  function splitLine(key: string) {
    setLines((prev) => {
      const index = prev.findIndex((line) => line.key === key);
      if (index === -1) return prev;
      const original = prev[index];
      const quantity = Number.parseInt(original.quantity, 10);
      if (!Number.isFinite(quantity) || quantity < 2) return prev;
      const firstHalf = Math.ceil(quantity / 2);
      const secondHalf = quantity - firstHalf;
      const updatedOriginal = { ...original, quantity: String(firstHalf) };
      const newLine: DraftLine = {
        ...emptyLine(original.locationId),
        quantity: String(secondHalf),
        splitParentKey: original.key,
      };
      const next = [...prev];
      next[index] = updatedOriginal;
      next.splice(index + 1, 0, newLine);
      return next;
    });
  }

  function toggleSelected(key: string) {
    setLines((prev) =>
      prev.map((line) =>
        line.key === key ? { ...line, selected: !line.selected } : line,
      ),
    );
  }

  function assignLocationToSelected() {
    setLines((prev) =>
      prev.map((line) =>
        line.selected ? { ...line, locationId: bulkLocationId } : line,
      ),
    );
  }

  function clearSelection() {
    setLines((prev) => prev.map((line) => ({ ...line, selected: false })));
  }

  const selectedCount = lines.filter((line) => line.selected).length;

  const searchMatches =
    addQuery.trim().length > 0
      ? products
          .filter((product) => {
            const q = addQuery.trim().toLowerCase();
            return (
              product.name.toLowerCase().includes(q) ||
              (product.sku ? product.sku.toLowerCase().includes(q) : false)
            );
          })
          .slice(0, 8)
      : [];

  function validate(): string[] {
    const errors: string[] = [];
    if (supplierId === "" && !newSupplierName.trim()) {
      errors.push(t("validation.supplierRequired"));
    }
    lines.forEach((line, index) => {
      const eff = effectiveLine(line);
      const n = index + 1;
      if (eff.productId === "new" && !eff.newProductName.trim()) {
        errors.push(t("validation.lineProductRequired", { line: n }));
      }
      if (eff.productId === "new" && eff.newProductCategoryId === "") {
        errors.push(t("validation.lineCategoryRequired", { line: n }));
      }
      const quantity = Number.parseInt(line.quantity, 10);
      if (!Number.isFinite(quantity) || quantity <= 0) {
        errors.push(t("validation.lineQuantityRequired", { line: n }));
      }
      if (parseMoneyLoose(eff.purchasePriceRaw) === null) {
        errors.push(t("validation.linePurchasePriceRequired", { line: n }));
      }
      if (eff.salePriceRaw && parseMoneyLoose(eff.salePriceRaw) === null) {
        errors.push(t("validation.linePriceInvalid", { line: n }));
      }
    });
    return errors;
  }

  async function handleSubmit() {
    const errors = validate();
    setValidationErrors(errors);
    if (errors.length > 0) return;

    setIsSubmitting(true);
    setServerError(false);

    const input: PostPurchaseActionInput = {
      supplierId: supplierId === "" ? null : supplierId,
      newSupplierName: newSupplierName.trim() || null,
      defaultLocationId: formDefaultLocationId,
      receivedDate,
      lines: lines.map((rawLine) => {
        const line = effectiveLine(rawLine);
        return {
          productId: line.productId === "new" ? null : line.productId,
          newProductName:
            line.productId === "new"
              ? line.newProductName.trim() || null
              : null,
          newProductCategoryId:
            line.productId === "new"
              ? line.newProductCategoryId === ""
                ? null
                : line.newProductCategoryId
              : null,
          newProductSku:
            line.productId === "new" ? line.newProductSku.trim() || null : null,
          locationId: rawLine.locationId,
          quantity: Number.parseInt(rawLine.quantity, 10),
          purchasePriceRaw: line.purchasePriceRaw,
          salePriceRaw: line.salePriceRaw || null,
        };
      }),
    };

    const result = await postPurchaseAction(input);
    setIsSubmitting(false);

    if (!result.ok) {
      setServerError(true);
      return;
    }

    showToast({ message: t("posted") });
    router.push(`/${locale}/receipts/${result.purchaseId}`);
  }

  // Footer totals: ui.md forbids summing quantities across different products (no "N pcs"
  // cross-product total, in a footer or anywhere else) — only line/product counts and money.
  let totalAmount = 0;
  const productIdsSeen = new Set<string>();
  for (const line of lines) {
    const eff = effectiveLine(line);
    const quantity = Number.parseInt(line.quantity, 10) || 0;
    const price = parseMoneyLoose(eff.purchasePriceRaw) ?? 0;
    totalAmount += price * quantity;
    productIdsSeen.add(
      eff.productId === "new"
        ? `new:${eff.newProductName}`
        : `${eff.productId}`,
    );
  }

  return (
    <div className="flex flex-col gap-4 pb-20">
      <h1 className="text-2xl font-bold tracking-tight text-foreground">
        {t("newReceiptTitle")}
      </h1>

      {validationErrors.length > 0 && (
        <FormErrorBanner
          title={t("invalidInputTitle")}
          description={validationErrors.join(" · ")}
        />
      )}
      {serverError && (
        <FormErrorBanner
          title={t("invalidInputTitle")}
          description={t("invalidInput")}
        />
      )}

      <div className="flex flex-wrap items-end gap-4 rounded-xl border border-border bg-card p-4">
        <div className="flex flex-col gap-1">
          <Label htmlFor="purchase-supplier">{t("supplierLabel")}</Label>
          <select
            id="purchase-supplier"
            value={supplierId}
            onChange={(event) =>
              setSupplierId(
                event.target.value === "" ? "" : Number(event.target.value),
              )
            }
            className="h-9 w-56 rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            <option value="">{t("selectSupplier")}</option>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.name}
              </option>
            ))}
          </select>
          {supplierId === "" && (
            <Input
              placeholder={t("newSupplierLabel")}
              value={newSupplierName}
              onChange={(event) => setNewSupplierName(event.target.value)}
              className="w-56"
            />
          )}
        </div>

        <div className="flex flex-col gap-1">
          <Label htmlFor="purchase-received-date">
            {t("receivedDateLabel")}
          </Label>
          <Input
            id="purchase-received-date"
            type="date"
            value={receivedDate}
            onChange={(event) => setReceivedDate(event.target.value)}
            className="w-40"
          />
        </div>

        <div className="flex flex-col gap-1">
          <Label>{t("defaultLocationLabel")}</Label>
          <div className="inline-flex items-center gap-1 rounded-lg bg-muted p-1">
            {locations.map((location) => (
              <button
                key={location.id}
                type="button"
                onClick={() => setFormDefaultLocationId(location.id)}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  formDefaultLocationId === location.id
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <LocationDot type={location.type} />
                {location.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {selectedCount > 0 && (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-border bg-accent/30 px-3 py-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">
              {t("selectedCount", { count: selectedCount })}
            </span>
            <span className="text-sm text-muted-foreground">
              {t("moveToLabel")}
            </span>
            <select
              value={bulkLocationId}
              onChange={(event) =>
                setBulkLocationId(Number(event.target.value))
              }
              className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground outline-none"
            >
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </select>
            <Button type="button" size="sm" onClick={assignLocationToSelected}>
              {t("apply")}
            </Button>
          </div>
          <button
            type="button"
            onClick={clearSelection}
            className="text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            {t("clearSelection")}
          </button>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted text-left text-muted-foreground">
              <th className="w-8 px-3 py-2" />
              <th className="px-2 py-2 font-medium">{t("lineProductLabel")}</th>
              <th className="px-2 py-2 font-medium">
                {t("lineLocationLabel")}
              </th>
              <th className="px-2 py-2 text-right font-medium">
                {t("quantityLabel")}
              </th>
              <th className="px-2 py-2 text-right font-medium">
                {t("purchasePriceLabel")}, {currencyLabel(currency, locale)}
              </th>
              <th className="px-2 py-2 text-right font-medium">
                {t("salePriceLabel")}, {currencyLabel(currency, locale)}
              </th>
              <th className="px-2 py-2 text-right font-medium">
                {t("sumColumn")}, {currencyLabel(currency, locale)}
              </th>
              <th className="w-16 px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => {
              const parent = parentOf(line);
              const eff = effectiveLine(line);
              const existingProduct =
                eff.productId !== "new" ? productMap.get(eff.productId) : null;
              const stock =
                eff.productId !== "new"
                  ? (stockMap.get(eff.productId) ?? [])
                  : [];
              const current =
                eff.productId !== "new"
                  ? priceMap.get(eff.productId)
                  : undefined;
              const quantity = Number.parseInt(line.quantity, 10) || 0;
              const purchasePrice = parseMoneyLoose(eff.purchasePriceRaw);
              const salePrice = parseMoneyLoose(eff.salePriceRaw);
              const margin =
                purchasePrice && purchasePrice > 0 && salePrice
                  ? Math.round(
                      ((salePrice - purchasePrice) / purchasePrice) * 100,
                    )
                  : null;
              const priceChanged =
                current && purchasePrice !== null
                  ? purchasePrice !== current.purchasePrice
                  : false;
              const lineTotal =
                purchasePrice !== null ? purchasePrice * quantity : 0;

              const location = locations.find((l) => l.id === line.locationId);

              return (
                <tr
                  key={line.key}
                  className="border-b border-border last:border-b-0 align-top hover:bg-muted/30"
                >
                  <td className="px-3 py-2">
                    {!parent && (
                      <input
                        type="checkbox"
                        aria-label={t("selectLine")}
                        checked={line.selected}
                        onChange={() => toggleSelected(line.key)}
                        className="size-4 rounded border-input accent-primary"
                      />
                    )}
                  </td>
                  <td className="px-2 py-2">
                    {parent ? (
                      <div className="pl-4 text-sm text-muted-foreground">
                        <p className="font-medium text-foreground">
                          {/* eslint-disable-next-line i18next/no-literal-string -- decorative glyph, not text */}
                          <span aria-hidden="true">↳ </span>
                          {t("splitChildLabel")}
                        </p>
                        <p className="text-xs">{t("splitChildHint")}</p>
                      </div>
                    ) : eff.productId === "new" ? (
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                          <Input
                            value={line.newProductName}
                            placeholder={t("newProductNameLabel")}
                            onChange={(event) =>
                              updateLine(line.key, {
                                newProductName: event.target.value,
                              })
                            }
                            className="w-56"
                          />
                          <span className="rounded-full bg-warning px-2 py-0.5 text-xs font-medium text-warning-foreground">
                            {t("newProductBadge")}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-end gap-2 rounded-lg border border-dashed border-border bg-muted/40 p-2">
                          <div className="flex flex-col gap-1">
                            <Label className="text-xs">
                              {t("newProductCategoryLabel")}
                            </Label>
                            <select
                              value={line.newProductCategoryId}
                              onChange={(event) =>
                                updateLine(line.key, {
                                  newProductCategoryId:
                                    event.target.value === ""
                                      ? ""
                                      : Number(event.target.value),
                                })
                              }
                              className="h-8 w-44 rounded-md border border-input bg-transparent px-2 text-xs text-foreground outline-none"
                            >
                              <option value="" />
                              {categories.map((category) => (
                                <option key={category.id} value={category.id}>
                                  {category.label}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="flex flex-col gap-1">
                            <Label className="text-xs">
                              {t("newProductSkuLabel")}
                            </Label>
                            <Input
                              className="h-8 w-24 text-xs"
                              value={line.newProductSku}
                              onChange={(event) =>
                                updateLine(line.key, {
                                  newProductSku: event.target.value,
                                })
                              }
                            />
                          </div>
                          <div className="flex flex-col gap-1">
                            <Label className="text-xs">
                              {t("minStockLabel")}
                            </Label>
                            <p className="flex h-8 w-14 items-center justify-center rounded-md bg-muted text-xs font-medium text-muted-foreground">
                              {startingMinStock(quantity)}
                            </p>
                          </div>
                          <p className="w-full text-xs text-muted-foreground">
                            {t("minStockHint")}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <p className="font-medium text-foreground">
                          {existingProduct?.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {existingProduct?.sku}
                          {stock.length > 0 &&
                            ` · ${t("stockHintPrefix")}: ${stock
                              .map(
                                ([qty, name]) =>
                                  `${name} ${formatNumber(qty, locale)}`,
                              )
                              .join(", ")}`}
                        </p>
                      </div>
                    )}
                  </td>
                  <td className="px-2 py-2">
                    <select
                      value={line.locationId}
                      onChange={(event) =>
                        updateLine(line.key, {
                          locationId: Number(event.target.value),
                        })
                      }
                      className="h-8 rounded-md border border-input bg-transparent px-2 text-sm text-foreground outline-none"
                    >
                      {locations.map((loc) => (
                        <option key={loc.id} value={loc.id}>
                          {loc.name}
                        </option>
                      ))}
                    </select>
                    {location && (
                      <LocationDot type={location.type} className="ml-1.5" />
                    )}
                  </td>
                  <td className="px-2 py-2 text-right">
                    <Input
                      className="w-16 text-right"
                      inputMode="numeric"
                      value={line.quantity}
                      onChange={(event) =>
                        updateLine(line.key, { quantity: event.target.value })
                      }
                    />
                  </td>
                  <td className="px-2 py-2 text-right">
                    {parent ? (
                      <p className="flex h-8 items-center justify-end text-muted-foreground">
                        {eff.purchasePriceRaw || "—"}
                      </p>
                    ) : (
                      <Input
                        className="w-24 text-right"
                        value={line.purchasePriceRaw}
                        onChange={(event) =>
                          updateLine(line.key, {
                            purchasePriceRaw: event.target.value,
                          })
                        }
                      />
                    )}
                    {!parent && priceChanged && current && (
                      <p className="text-right text-xs text-warning-foreground">
                        {t("wasPriceHint", {
                          price: formatMoneyBare(current.purchasePrice, {
                            locale,
                          }),
                        })}
                      </p>
                    )}
                    {!parent && margin !== null && (
                      <p className="text-right text-xs text-muted-foreground">
                        {t("marginHint", { percent: margin })}
                      </p>
                    )}
                  </td>
                  <td className="px-2 py-2 text-right">
                    {parent ? (
                      <p className="flex h-8 items-center justify-end text-muted-foreground">
                        {eff.salePriceRaw || "—"}
                      </p>
                    ) : (
                      <Input
                        className="w-24 text-right"
                        placeholder={
                          current?.salePrice
                            ? formatMoneyBare(current.salePrice, { locale })
                            : undefined
                        }
                        value={line.salePriceRaw}
                        onChange={(event) =>
                          updateLine(line.key, {
                            salePriceRaw: event.target.value,
                          })
                        }
                      />
                    )}
                  </td>
                  <td className="px-2 py-2 text-right font-medium text-foreground">
                    {purchasePrice !== null
                      ? formatMoneyBare(lineTotal, { locale })
                      : "—"}
                  </td>
                  <td className="px-2 py-2">
                    <div className="flex items-center justify-end gap-1">
                      {!parent && (
                        <button
                          type="button"
                          aria-label={t("splitLine")}
                          onClick={() => splitLine(line.key)}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <Split className="size-4" />
                        </button>
                      )}
                      <button
                        type="button"
                        aria-label={t("removeLine")}
                        onClick={() => removeLine(line.key)}
                        disabled={lines.length === 1 && !parent}
                        className="text-muted-foreground hover:text-destructive disabled:pointer-events-none disabled:opacity-40"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            <tr>
              <td className="px-3 py-2" />
              <td colSpan={7} className="px-2 py-2">
                <div className="relative">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Plus className="size-4" />
                    <input
                      value={addQuery}
                      onChange={(event) => {
                        setAddQuery(event.target.value);
                        setHighlightIndex(0);
                      }}
                      onKeyDown={(event) => {
                        const optionCount = searchMatches.length + 1; // +1 = "create new"
                        if (event.key === "ArrowDown") {
                          event.preventDefault();
                          setHighlightIndex((i) => (i + 1) % optionCount);
                          return;
                        }
                        if (event.key === "ArrowUp") {
                          event.preventDefault();
                          setHighlightIndex(
                            (i) => (i - 1 + optionCount) % optionCount,
                          );
                          return;
                        }
                        if (event.key !== "Enter") return;
                        if (
                          searchMatches.length > 0 &&
                          highlightIndex < searchMatches.length
                        ) {
                          addProductLine(searchMatches[highlightIndex].id);
                        } else if (addQuery.trim()) {
                          addProductLine("new", addQuery.trim());
                        }
                      }}
                      placeholder={t("addProductPlaceholder")}
                      className="h-8 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                    />
                    <kbd className="rounded border border-border px-1 text-[0.65rem] text-muted-foreground">
                      {t("enterKeyHint")}
                    </kbd>
                  </div>
                  {searchMatches.length > 0 && (
                    <div className="absolute top-full right-0 left-0 z-50 mt-1 flex flex-col rounded-lg border border-border bg-card p-1 shadow-md">
                      {searchMatches.map((product, index) => {
                        const price = priceMap.get(product.id);
                        const stock = stockMap.get(product.id) ?? [];
                        const stockHint =
                          stock.length > 0
                            ? stock
                                .map(
                                  ([qty, name]) =>
                                    `${name} ${formatNumber(qty, locale)}`,
                                )
                                .join(", ")
                            : null;
                        return (
                          <button
                            key={product.id}
                            type="button"
                            onClick={() => addProductLine(product.id)}
                            onMouseEnter={() => setHighlightIndex(index)}
                            className={cn(
                              "flex items-center justify-between rounded-md px-2 py-1.5 text-left text-sm",
                              index === highlightIndex
                                ? "bg-muted"
                                : "hover:bg-muted",
                            )}
                          >
                            <span className="flex flex-col">
                              <span className="font-medium text-foreground">
                                {product.name}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {product.sku}
                                {price &&
                                  ` · ${t("wasPriceHint", { price: formatMoneyBare(price.purchasePrice, { locale }) })} ${currencyLabel(currency, locale)}`}
                                {stockHint &&
                                  ` · ${t("stockHintPrefix")}: ${stockHint}`}
                              </span>
                            </span>
                          </button>
                        );
                      })}
                      <button
                        type="button"
                        onClick={() => addProductLine("new", addQuery.trim())}
                        onMouseEnter={() =>
                          setHighlightIndex(searchMatches.length)
                        }
                        className={cn(
                          "rounded-md px-2 py-1.5 text-left text-sm text-muted-foreground",
                          highlightIndex === searchMatches.length
                            ? "bg-muted"
                            : "hover:bg-muted",
                        )}
                      >
                        {t("createNewProductOption", { name: addQuery.trim() })}
                      </button>
                    </div>
                  )}
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 shadow-[0_-2px_8px_rgba(0,0,0,0.04)]">
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <span>{t("productCountFooter", { count: productIdsSeen.size })}</span>
          <span>{t("lineCountFooter", { count: lines.length })}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-semibold text-foreground">
            {t("totalPurchaseLabel")} {formatMoneyBare(totalAmount, { locale })}{" "}
            {currencyLabel(currency, locale)}
          </span>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push(`/${locale}/receipts`)}
          >
            {t("cancel")}
          </Button>
          <Button
            type="button"
            disabled={isSubmitting}
            onClick={() => void handleSubmit()}
          >
            {t("post")}
          </Button>
        </div>
      </div>
    </div>
  );
}
