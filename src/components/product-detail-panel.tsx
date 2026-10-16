"use client";

import { useActionState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LocationDot } from "@/components/location-dot";
import {
  ProductNotesList,
  ProductNotesPopover,
} from "@/components/product-notes-popover";
import { useToast } from "@/components/toast-provider";
import { formatDateOnlyCompact, monthStartDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import {
  archiveProductAction,
  updateProductAction,
  type ProductFormState,
} from "@/server/actions/products";
import type { ActiveProductNote } from "@/server/services/product-notes";
import type { Product } from "@/server/services/products";

const initialState: ProductFormState = {};

export function ProductDetailPanel({
  product,
  breadcrumb,
  categories,
  suppliers,
  stockByLocation,
  priceHistory,
  noteMonth,
  noteTypes,
  activeNotes,
  currency,
  locale,
}: {
  product: Product;
  breadcrumb: string;
  categories: { id: number; label: string }[];
  suppliers: { id: number; name: string }[];
  stockByLocation: {
    locationId: number;
    locationName: string;
    locationType: "warehouse" | "shop";
    quantity: number;
  }[];
  priceHistory: {
    id: number;
    purchasePrice: number;
    salePrice: number | null;
    effectiveFrom: string;
  }[];
  noteMonth: string;
  noteTypes: { id: number; name: string; color: string }[];
  activeNotes: ActiveProductNote[];
  currency: string;
  locale: string;
}) {
  const t = useTranslations("products");
  const roleT = useTranslations("roles");
  const notesT = useTranslations("productNotes");
  const { showToast } = useToast();
  const router = useRouter();
  const boundAction = updateProductAction.bind(null, product.id);
  const [state, formAction, isPending] = useActionState(
    boundAction,
    initialState,
  );

  const wasPendingRef = useRef(false);
  useEffect(() => {
    if (wasPendingRef.current && !isPending && !state.error) {
      showToast({ message: t("saved") });
    }
    wasPendingRef.current = isPending;
    // showToast/t are stable across renders; re-running this on every render would re-fire the
    // toast, not just after a real pending → settled transition.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPending, state]);

  const moneyOptions = { currency, locale };

  return (
    <div className="flex flex-col gap-6 rounded-xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">{breadcrumb}</p>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-foreground">
              {product.name}
            </h2>
            <ProductNotesPopover
              productId={product.id}
              productName={product.name}
              month={noteMonth}
              notes={activeNotes}
              noteTypes={noteTypes}
            />
          </div>
        </div>
        <Link
          href={`/${locale}/products`}
          aria-label={t("closeLabel")}
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="size-4" />
        </Link>
      </div>

      <form action={formAction} className="flex flex-col gap-5">
        <section className="flex flex-col gap-3">
          <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            {t("detailBasicsSection")}
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 flex flex-col gap-1.5">
              <Label htmlFor="name">{t("nameLabel")}</Label>
              <Input
                id="name"
                name="name"
                defaultValue={product.name}
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sku">{t("skuLabel")}</Label>
              <Input id="sku" name="sku" defaultValue={product.sku ?? ""} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="categoryId">{t("categoryLabel")}</Label>
              <select
                id="categoryId"
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
            <div className="col-span-2 flex flex-col gap-1.5">
              <Label htmlFor="defaultSupplierId">{t("supplierLabel")}</Label>
              <select
                id="defaultSupplierId"
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
              {priceHistory[0] && (
                <p className="text-xs text-muted-foreground">
                  {t("lastDeliveryHint", {
                    date: formatDateOnlyCompact(
                      priceHistory[0].effectiveFrom,
                      locale,
                    ),
                  })}
                </p>
              )}
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            {t("detailStockSection")}
          </h3>
          <div className="flex flex-wrap gap-2">
            {stockByLocation.map((row) => (
              <div
                key={row.locationId}
                className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2"
              >
                <LocationDot type={row.locationType} />
                <span className="text-sm text-muted-foreground">
                  {row.locationName}
                </span>
                <span className="text-sm font-semibold text-foreground">
                  {row.quantity}
                </span>
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="minStock">{t("minStockLabel")}</Label>
            <Input
              id="minStock"
              name="minStock"
              type="number"
              min={0}
              defaultValue={product.minStock}
              className="w-28"
            />
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            {t("detailPricesSection")}
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-muted px-3 py-2">
              <p className="text-xs text-muted-foreground">
                {t("purchasePriceLabel")}
              </p>
              <p className="text-lg font-bold text-foreground">
                {priceHistory[0]
                  ? formatMoney(priceHistory[0].purchasePrice, moneyOptions)
                  : "—"}
              </p>
            </div>
            <div className="rounded-lg bg-muted px-3 py-2">
              <p className="text-xs text-muted-foreground">
                {t("salePriceLabel")}
              </p>
              <p className="text-lg font-bold text-foreground">
                {priceHistory[0]?.salePrice != null
                  ? formatMoney(priceHistory[0].salePrice, moneyOptions)
                  : "—"}
              </p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            {t("pricesChangeViaReceiptHint")}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="purchasePrice">
                {t("newPurchasePriceLabel")}
              </Label>
              <Input
                id="purchasePrice"
                name="purchasePrice"
                placeholder={t("leaveBlankToKeep")}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="salePrice">{t("newSalePriceLabel")}</Label>
              <Input
                id="salePrice"
                name="salePrice"
                placeholder={t("leaveBlankToKeep")}
              />
            </div>
          </div>
          {priceHistory.length > 0 && (
            <div className="overflow-hidden rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted text-left text-muted-foreground">
                    <th className="px-2.5 py-1.5 font-medium">
                      {t("priceEffectiveFromColumn")}
                    </th>
                    <th className="px-2.5 py-1.5 text-right font-medium">
                      {t("purchasePriceLabel")}
                    </th>
                    <th className="px-2.5 py-1.5 text-right font-medium">
                      {t("salePriceLabel")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {priceHistory.map((entry) => (
                    <tr
                      key={entry.id}
                      className="border-b border-border last:border-b-0"
                    >
                      <td className="px-2.5 py-1.5 text-foreground">
                        {formatDateOnlyCompact(entry.effectiveFrom, locale)}
                      </td>
                      <td className="px-2.5 py-1.5 text-right text-foreground">
                        {formatMoney(entry.purchasePrice, moneyOptions)}
                      </td>
                      <td className="px-2.5 py-1.5 text-right text-foreground">
                        {entry.salePrice !== null
                          ? formatMoney(entry.salePrice, moneyOptions)
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {noteTypes.length > 0 && (
          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                {notesT("header", {
                  month: new Intl.DateTimeFormat(locale, {
                    month: "long",
                  }).format(new Date(`${monthStartDate(noteMonth)}T00:00:00Z`)),
                })}
              </h3>
            </div>
            <ProductNotesList
              productId={product.id}
              month={noteMonth}
              notes={activeNotes}
              noteTypes={noteTypes}
            />
          </section>
        )}

        {state.error && (
          <p className="text-sm text-destructive" role="alert">
            {t("invalidInput")}
          </p>
        )}

        <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
          <Button
            type="button"
            variant="outline"
            className="text-destructive hover:text-destructive"
            onClick={() => {
              void archiveProductAction(product.id);
              showToast({
                message: t("archivedToast", { name: product.name }),
              });
              router.push("../products");
            }}
          >
            {t("archive")}
          </Button>
          <span className="text-xs text-muted-foreground">
            {t("createdLabel", {
              date: formatDateOnlyCompact(
                product.createdAt.toISOString().slice(0, 10),
                locale,
              ),
              role: roleT("owner"),
            })}
          </span>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              nativeButton={false}
              render={<Link href={`/${locale}/products`} />}
            >
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={isPending}>
              {t("save")}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
