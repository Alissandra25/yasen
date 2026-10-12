"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createProductAction,
  type ProductFormState,
} from "@/server/actions/products";

const initialState: ProductFormState = {};

export function ProductForm({
  categories,
  suppliers,
}: {
  categories: { id: number; label: string }[];
  suppliers: { id: number; name: string }[];
}) {
  const t = useTranslations("products");
  const [state, formAction, isPending] = useActionState(
    createProductAction,
    initialState,
  );

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="name">{t("nameLabel")}</Label>
        <Input id="name" name="name" required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="sku">{t("skuLabel")}</Label>
        <Input id="sku" name="sku" className="w-28" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="categoryId">{t("categoryLabel")}</Label>
        <select
          id="categoryId"
          name="categoryId"
          required
          defaultValue=""
          className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground"
        >
          <option value="" disabled>
            {t("selectCategory")}
          </option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="defaultSupplierId">{t("supplierLabel")}</Label>
        <select
          id="defaultSupplierId"
          name="defaultSupplierId"
          defaultValue=""
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
        <Label htmlFor="minStock">{t("minStockLabel")}</Label>
        <Input
          id="minStock"
          name="minStock"
          type="number"
          min={0}
          defaultValue={0}
          className="w-20"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="purchasePrice">{t("purchasePriceLabel")}</Label>
        <Input
          id="purchasePrice"
          name="purchasePrice"
          placeholder="0.00"
          className="w-24"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="salePrice">{t("salePriceLabel")}</Label>
        <Input
          id="salePrice"
          name="salePrice"
          placeholder="0.00"
          className="w-24"
        />
      </div>
      {state.error && (
        <p className="text-sm text-destructive" role="alert">
          {t("invalidInput")}
        </p>
      )}
      <Button type="submit" disabled={isPending}>
        {t("add")}
      </Button>
    </form>
  );
}
