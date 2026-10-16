"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createProductAction,
  type ProductFormState,
} from "@/server/actions/products";

const initialState: ProductFormState = {};

export function ProductCreateDialog({
  categories,
  suppliers,
}: {
  categories: { id: number; label: string }[];
  suppliers: { id: number; name: string }[];
}) {
  const t = useTranslations("products");
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(
    createProductAction,
    initialState,
  );

  const wasPendingRef = useRef(false);
  useEffect(() => {
    if (wasPendingRef.current && !isPending && !state.error) {
      setOpen(false);
    }
    wasPendingRef.current = isPending;
  }, [isPending, state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button type="button" size="sm">
            <Plus className="size-4" />
            {t("newProductButton")}
          </Button>
        }
      />
      <DialogContent>
        <form action={formAction} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{t("newProductButton")}</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 flex flex-col gap-1.5">
              <Label htmlFor="create-name">{t("nameLabel")}</Label>
              <Input id="create-name" name="name" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="create-sku">{t("skuLabel")}</Label>
              <Input id="create-sku" name="sku" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="create-categoryId">{t("categoryLabel")}</Label>
              <select
                id="create-categoryId"
                name="categoryId"
                required
                defaultValue=""
                className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
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
              <Label htmlFor="create-defaultSupplierId">
                {t("supplierLabel")}
              </Label>
              <select
                id="create-defaultSupplierId"
                name="defaultSupplierId"
                defaultValue=""
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
              <Label htmlFor="create-minStock">{t("minStockLabel")}</Label>
              <Input
                id="create-minStock"
                name="minStock"
                type="number"
                min={0}
                defaultValue={0}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="create-purchasePrice">
                {t("purchasePriceLabel")}
              </Label>
              <Input
                id="create-purchasePrice"
                name="purchasePrice"
                placeholder="0.00"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="create-salePrice">{t("salePriceLabel")}</Label>
              <Input
                id="create-salePrice"
                name="salePrice"
                placeholder="0.00"
              />
            </div>
          </div>

          {state.error && (
            <p className="text-sm text-destructive" role="alert">
              {t("invalidInput")}
            </p>
          )}

          <DialogFooter>
            <DialogClose
              render={
                <Button type="button" variant="outline">
                  {t("cancel")}
                </Button>
              }
            />
            <Button type="submit" disabled={isPending}>
              {t("add")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
