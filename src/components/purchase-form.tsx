"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  };
}

export function PurchaseForm({
  suppliers,
  locations,
  products,
  categories,
}: {
  suppliers: { id: number; name: string }[];
  locations: { id: number; name: string }[];
  products: { id: number; name: string }[];
  categories: { id: number; label: string }[];
}) {
  const t = useTranslations("receipts");
  const defaultLocationId = locations[0]?.id ?? 0;

  const [supplierId, setSupplierId] = useState<number | "">("");
  const [newSupplierName, setNewSupplierName] = useState("");
  const [formDefaultLocationId, setFormDefaultLocationId] =
    useState(defaultLocationId);
  const [lines, setLines] = useState<DraftLine[]>([
    emptyLine(defaultLocationId),
  ]);
  const [bulkLocationId, setBulkLocationId] = useState(defaultLocationId);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<"error" | "posted" | null>(null);

  function updateLine(key: string, patch: Partial<DraftLine>) {
    setLines((prev) =>
      prev.map((line) => (line.key === key ? { ...line, ...patch } : line)),
    );
  }

  function addLine() {
    setLines((prev) => [...prev, emptyLine(formDefaultLocationId)]);
  }

  function removeLine(key: string) {
    setLines((prev) => prev.filter((line) => line.key !== key));
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
        ...original,
        key: makeKey(),
        quantity: String(secondHalf),
        selected: false,
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

  async function handleSubmit() {
    setIsSubmitting(true);
    setMessage(null);

    const input: PostPurchaseActionInput = {
      supplierId: supplierId === "" ? null : supplierId,
      newSupplierName: newSupplierName.trim() || null,
      defaultLocationId: formDefaultLocationId,
      lines: lines.map((line) => ({
        productId: line.productId === "new" ? null : line.productId,
        newProductName:
          line.productId === "new" ? line.newProductName.trim() || null : null,
        newProductCategoryId:
          line.productId === "new"
            ? line.newProductCategoryId === ""
              ? null
              : line.newProductCategoryId
            : null,
        newProductSku:
          line.productId === "new" ? line.newProductSku.trim() || null : null,
        locationId: line.locationId,
        quantity: Number.parseInt(line.quantity, 10),
        purchasePriceRaw: line.purchasePriceRaw,
        salePriceRaw: line.salePriceRaw || null,
      })),
    };

    const result = await postPurchaseAction(input);
    setIsSubmitting(false);

    if (!result.ok) {
      setMessage("error");
      return;
    }

    setMessage("posted");
    setSupplierId("");
    setNewSupplierName("");
    setLines([emptyLine(formDefaultLocationId)]);
  }

  const selectedCount = lines.filter((line) => line.selected).length;

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border p-4">
      <h3 className="text-sm font-semibold text-foreground">
        {t("newReceiptTitle")}
      </h3>

      <div className="flex flex-wrap gap-4">
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
            className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground"
          >
            <option value="">{t("selectSupplier")}</option>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="purchase-new-supplier">{t("newSupplierLabel")}</Label>
          <Input
            id="purchase-new-supplier"
            value={newSupplierName}
            onChange={(event) => setNewSupplierName(event.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="purchase-default-location">
            {t("defaultLocationLabel")}
          </Label>
          <select
            id="purchase-default-location"
            value={formDefaultLocationId}
            onChange={(event) =>
              setFormDefaultLocationId(Number(event.target.value))
            }
            className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground"
          >
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {selectedCount > 0 && (
        <div className="flex items-center gap-2">
          <select
            value={bulkLocationId}
            onChange={(event) => setBulkLocationId(Number(event.target.value))}
            className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground"
          >
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name}
              </option>
            ))}
          </select>
          <Button type="button" size="sm" onClick={assignLocationToSelected}>
            {t("assignLocationToSelected")} ({selectedCount})
          </Button>
        </div>
      )}

      <ul className="flex flex-col gap-3">
        {lines.map((line) => (
          <li
            key={line.key}
            className="flex flex-wrap items-end gap-3 rounded-lg border border-border p-3"
          >
            <input
              type="checkbox"
              aria-label={t("selectLine")}
              checked={line.selected}
              onChange={() => toggleSelected(line.key)}
            />
            <div className="flex flex-col gap-1">
              <Label>{t("lineProductLabel")}</Label>
              <select
                value={line.productId}
                onChange={(event) =>
                  updateLine(line.key, {
                    productId:
                      event.target.value === "new"
                        ? "new"
                        : Number(event.target.value),
                  })
                }
                className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground"
              >
                <option value="new">{t("newProductOption")}</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </select>
            </div>

            {line.productId === "new" && (
              <>
                <div className="flex flex-col gap-1">
                  <Label>{t("newProductNameLabel")}</Label>
                  <Input
                    value={line.newProductName}
                    onChange={(event) =>
                      updateLine(line.key, {
                        newProductName: event.target.value,
                      })
                    }
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label>{t("newProductCategoryLabel")}</Label>
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
                    className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground"
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
                  <Label>{t("newProductSkuLabel")}</Label>
                  <Input
                    value={line.newProductSku}
                    onChange={(event) =>
                      updateLine(line.key, {
                        newProductSku: event.target.value,
                      })
                    }
                  />
                </div>
              </>
            )}

            <div className="flex flex-col gap-1">
              <Label>{t("lineLocationLabel")}</Label>
              <select
                value={line.locationId}
                onChange={(event) =>
                  updateLine(line.key, {
                    locationId: Number(event.target.value),
                  })
                }
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
              <Label>{t("quantityLabel")}</Label>
              <Input
                className="w-20"
                inputMode="numeric"
                value={line.quantity}
                onChange={(event) =>
                  updateLine(line.key, { quantity: event.target.value })
                }
              />
            </div>

            <div className="flex flex-col gap-1">
              <Label>{t("purchasePriceLabel")}</Label>
              <Input
                className="w-24"
                value={line.purchasePriceRaw}
                onChange={(event) =>
                  updateLine(line.key, { purchasePriceRaw: event.target.value })
                }
              />
            </div>

            <div className="flex flex-col gap-1">
              <Label>{t("salePriceLabel")}</Label>
              <Input
                className="w-24"
                value={line.salePriceRaw}
                onChange={(event) =>
                  updateLine(line.key, { salePriceRaw: event.target.value })
                }
              />
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => splitLine(line.key)}
            >
              {t("splitLine")}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => removeLine(line.key)}
              disabled={lines.length === 1}
            >
              {t("removeLine")}
            </Button>
          </li>
        ))}
      </ul>

      <div className="flex items-center gap-3">
        <Button type="button" variant="outline" size="sm" onClick={addLine}>
          {t("addLine")}
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={isSubmitting}
          onClick={() => void handleSubmit()}
        >
          {t("post")}
        </Button>
      </div>

      {message === "error" && (
        <p className="text-sm text-destructive">{t("invalidInput")}</p>
      )}
      {message === "posted" && (
        <p className="text-sm text-muted-foreground">{t("posted")}</p>
      )}
    </div>
  );
}
