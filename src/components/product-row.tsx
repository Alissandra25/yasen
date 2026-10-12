"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  archiveProductAction,
  updateProductAction,
  type ProductFormState,
} from "@/server/actions/products";
import type { Product } from "@/server/services/products";

const initialState: ProductFormState = {};

export function ProductRow({
  product,
  categories,
  suppliers,
  isArchiveCandidate,
  selected,
  onToggleSelected,
}: {
  product: Product;
  categories: { id: number; label: string }[];
  suppliers: { id: number; name: string }[];
  isArchiveCandidate: boolean;
  selected: boolean;
  onToggleSelected: () => void;
}) {
  const t = useTranslations("products");
  const [editing, setEditing] = useState(false);
  const boundAction = updateProductAction.bind(null, product.id);
  const [state, formAction, isPending] = useActionState(
    boundAction,
    initialState,
  );

  const categoryLabel =
    categories.find((category) => category.id === product.categoryId)?.label ??
    "";

  if (!editing) {
    return (
      <li className="flex items-center justify-between gap-4 rounded-lg border border-border px-3 py-2">
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggleSelected}
            aria-label={t("selectForBulkAction")}
          />
          <div>
            <p className="text-sm font-medium text-foreground">
              {product.name}
              {product.needsReview && (
                <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                  {t("needsReviewBadge")}
                </span>
              )}
              {isArchiveCandidate && (
                <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                  {t("archiveCandidateBadge")}
                </span>
              )}
            </p>
            <p className="text-xs text-muted-foreground">
              {categoryLabel}
              {product.sku ? ` · ${product.sku}` : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setEditing(true)}
          >
            {t("edit")}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void archiveProductAction(product.id)}
          >
            {t("archive")}
          </Button>
        </div>
      </li>
    );
  }

  return (
    <li className="rounded-lg border border-border px-3 py-2">
      <form action={formAction} className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`name-${product.id}`}>{t("nameLabel")}</Label>
          <Input
            id={`name-${product.id}`}
            name="name"
            defaultValue={product.name}
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`sku-${product.id}`}>{t("skuLabel")}</Label>
          <Input
            id={`sku-${product.id}`}
            name="sku"
            defaultValue={product.sku ?? ""}
            className="w-28"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`categoryId-${product.id}`}>
            {t("categoryLabel")}
          </Label>
          <select
            id={`categoryId-${product.id}`}
            name="categoryId"
            defaultValue={product.categoryId}
            required
            className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground"
          >
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`defaultSupplierId-${product.id}`}>
            {t("supplierLabel")}
          </Label>
          <select
            id={`defaultSupplierId-${product.id}`}
            name="defaultSupplierId"
            defaultValue={product.defaultSupplierId ?? ""}
            className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground"
          >
            <option value="">{t("noSupplier")}</option>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`minStock-${product.id}`}>{t("minStockLabel")}</Label>
          <Input
            id={`minStock-${product.id}`}
            name="minStock"
            type="number"
            min={0}
            defaultValue={product.minStock}
            className="w-20"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`purchasePrice-${product.id}`}>
            {t("purchasePriceLabel")}
          </Label>
          <Input
            id={`purchasePrice-${product.id}`}
            name="purchasePrice"
            placeholder={t("leaveBlankToKeep")}
            className="w-32"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`salePrice-${product.id}`}>
            {t("salePriceLabel")}
          </Label>
          <Input
            id={`salePrice-${product.id}`}
            name="salePrice"
            placeholder={t("leaveBlankToKeep")}
            className="w-32"
          />
        </div>
        {state.error && (
          <p className="text-sm text-destructive" role="alert">
            {t("invalidInput")}
          </p>
        )}
        <Button type="submit" size="sm" disabled={isPending}>
          {t("save")}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setEditing(false)}
        >
          {t("cancel")}
        </Button>
      </form>
    </li>
  );
}
