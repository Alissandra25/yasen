"use client";

import { useActionState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/toast-provider";
import { formatDateOnlyCompact } from "@/lib/dates";
import { formatMoneyBare, currencyLabel } from "@/lib/money";
import {
  archiveSupplierAction,
  updateSupplierAction,
  type SupplierFormState,
} from "@/server/actions/suppliers";
import type { Supplier } from "@/server/services/suppliers";

const initialState: SupplierFormState = {};

export function SupplierDetailPanel({
  supplier,
  products,
  deliveries,
  currency,
  locale,
}: {
  supplier: Supplier;
  products: { id: number; name: string; sku: string | null }[];
  deliveries: { id: number; createdAt: string; totalAmount: number }[];
  currency: string;
  locale: string;
}) {
  const t = useTranslations("suppliers");
  const { showToast } = useToast();
  const router = useRouter();
  const boundAction = updateSupplierAction.bind(null, supplier.id);
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

  const onlyNameFilled = !supplier.contacts && !supplier.note;

  return (
    <div className="flex flex-col gap-6 rounded-xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-foreground">
              {supplier.name}
            </h2>
            {supplier.needsReview && (
              <Badge className="bg-warning font-normal text-warning-foreground">
                {onlyNameFilled ? t("nameOnlyBadge") : t("needsReviewBadge")}
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {t("addedLabel", {
              date: formatDateOnlyCompact(
                supplier.createdAt.toISOString().slice(0, 10),
                locale,
              ),
            })}
          </p>
        </div>
        <Link
          href={`/${locale}/suppliers`}
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
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name">{t("nameLabel")}</Label>
              <Input
                id="name"
                name="name"
                defaultValue={supplier.name}
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="contacts">{t("contactsLabel")}</Label>
              <Input
                id="contacts"
                name="contacts"
                defaultValue={supplier.contacts ?? ""}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="note">{t("noteLabel")}</Label>
              <Input id="note" name="note" defaultValue={supplier.note ?? ""} />
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            {t("detailProductsSection", { count: products.length })}
          </h3>
          {products.length > 0 ? (
            <ul className="flex flex-col gap-1 rounded-lg border border-border">
              {products.map((product) => (
                <li
                  key={product.id}
                  className="border-b border-border px-3 py-1.5 text-sm last:border-b-0"
                >
                  <Link
                    href={`/${locale}/products/${product.id}`}
                    className="text-foreground hover:underline"
                  >
                    {product.name}
                  </Link>
                  {product.sku && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      {product.sku}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              {t("noProductsHint")}
            </p>
          )}
        </section>

        <section className="flex flex-col gap-3">
          <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            {t("detailDeliveriesSection")}
          </h3>
          {deliveries.length > 0 ? (
            <ul className="flex flex-col gap-1 rounded-lg border border-border">
              {deliveries.map((delivery) => (
                <li
                  key={delivery.id}
                  className="flex items-center justify-between border-b border-border px-3 py-1.5 text-sm last:border-b-0"
                >
                  <Link
                    href={`/${locale}/receipts/${delivery.id}`}
                    className="text-foreground hover:underline"
                  >
                    {formatDateOnlyCompact(delivery.createdAt, locale)}
                  </Link>
                  <span className="text-foreground">
                    {formatMoneyBare(delivery.totalAmount, { locale })}{" "}
                    {currencyLabel(currency, locale)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              {t("noDeliveriesHint")}
            </p>
          )}
        </section>

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
              void archiveSupplierAction(supplier.id);
              showToast({
                message: t("archivedToast", { name: supplier.name }),
              });
              router.push("../suppliers");
            }}
          >
            {t("archive")}
          </Button>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              nativeButton={false}
              render={<Link href={`/${locale}/suppliers`} />}
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
