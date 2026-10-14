"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/toast-provider";
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
  const locale = useLocale();
  const { showToast } = useToast();
  const [editing, setEditing] = useState(false);
  const boundAction = updateProductAction.bind(null, product.id);
  const [state, formAction, isPending] = useActionState(
    boundAction,
    initialState,
  );

  const wasPendingRef = useRef(false);
  useEffect(() => {
    if (wasPendingRef.current && !isPending && !state.error) {
      setEditing(false);
    }
    wasPendingRef.current = isPending;
  }, [isPending, state]);

  const categoryLabel =
    categories.find((category) => category.id === product.categoryId)?.label ??
    "";

  if (!editing) {
    return (
      <li
        className={`flex items-center justify-between gap-4 rounded-lg border px-3 py-2 ${
          selected ? "border-primary/40 bg-accent/40" : "border-border bg-card"
        }`}
      >
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggleSelected}
            aria-label={t("selectForBulkAction")}
            className="size-4 rounded border-input accent-primary"
          />
          <div>
            <p className="flex items-center gap-2 text-sm font-medium text-foreground">
              {product.name}
              {product.needsReview && (
                <Badge className="bg-warning text-warning-foreground">
                  {t("needsReviewBadge")}
                </Badge>
              )}
              {isArchiveCandidate && (
                <Badge variant="secondary">{t("archiveCandidateBadge")}</Badge>
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
            onClick={() => {
              void archiveProductAction(product.id);
              showToast({
                message: t("archivedToast", { name: product.name }),
              });
            }}
          >
            {t("archive")}
          </Button>
          <Link
            href={`/${locale}/products/${product.id}`}
            aria-label={t("openDetail", { name: product.name })}
            className="text-muted-foreground hover:text-foreground"
          >
            <ChevronRight className="size-4" />
          </Link>
        </div>
      </li>
    );
  }

  return (
    <li className="rounded-lg border border-border bg-card px-3 py-2">
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
            className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
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
            className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
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
