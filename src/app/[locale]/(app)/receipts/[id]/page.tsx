import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileDown, Repeat } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { LocationDot } from "@/components/location-dot";
import { formatInBusinessTimeZone } from "@/lib/dates";
import { formatMoney, formatMoneyBare, currencyLabel } from "@/lib/money";
import { getCurrentBusiness } from "@/server/services/business";
import { getPurchaseWithItems } from "@/server/services/purchases";
import { requireOwner } from "@/server/session";

export default async function ReceiptDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireOwner();
  const locale = await getLocale();
  const t = await getTranslations("receipts");
  const roleT = await getTranslations("roles");
  const { id } = await params;
  const purchaseId = Number(id);

  const result = await getPurchaseWithItems(user.businessId, purchaseId);
  if (!result) notFound();
  const { purchase, items } = result;

  const business = await getCurrentBusiness();
  const timezone = business?.timezone ?? "Europe/Kyiv";
  const currency = business?.currency ?? "UAH";

  const totalAmount = items.reduce(
    (sum, item) => sum + item.quantity * item.purchasePrice,
    0,
  );
  const locations = Array.from(
    new Map(
      items.map((item) => [
        item.locationId,
        {
          id: item.locationId,
          name: item.locationName,
          type: item.locationType,
        },
      ]),
    ).values(),
  );

  // A split line (receipt-form.tsx's "split") shows up here as a second purchase_items row for
  // the same product — render every row after the first one for a product as its child, per the
  // mockup's "↳ та сама позиція", instead of two identical-looking top-level rows.
  const seenProductIds = new Set<number>();
  const rows = items.map((item) => {
    const isSplitChild = seenProductIds.has(item.productId);
    seenProductIds.add(item.productId);
    return { item, isSplitChild };
  });

  const productsWithNewPrice = Array.from(
    new Map(
      items
        .filter((item) => item.salePrice !== null)
        .map((item) => [item.productId, item]),
    ).values(),
  );

  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <div>
        <Link
          href={`/${locale}/receipts`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          {t("backToAll")}
        </Link>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {t("detailTitle", { id: purchase.id })}
            </h1>
            <Badge className="bg-success/15 font-medium text-success">
              {t("postedStatus")}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={`/${locale}/receipts/${purchase.id}/pdf`}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ variant: "outline" })}
            >
              <FileDown className="size-4" />
              {t("printLabel")}
            </a>
            <Button type="button" variant="outline" disabled>
              {t("correctLabel")}
            </Button>
            <Button
              type="button"
              variant="outline"
              nativeButton={false}
              render={
                <Link
                  href={`/${locale}/receipts/new?supplierId=${purchase.supplierId}`}
                />
              }
            >
              <Repeat className="size-4" />
              {t("repeatLabel")}
            </Button>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          {t("postedBy", {
            supplier: purchase.supplierName,
            date: formatInBusinessTimeZone(
              purchase.createdAt,
              timezone,
              locale,
              { dateStyle: "long" },
            ),
            role: roleT(purchase.createdByRole),
            time: formatInBusinessTimeZone(
              purchase.createdAt,
              timezone,
              locale,
              { timeStyle: "short" },
            ),
          })}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">{t("amountStat")}</p>
          <p className="text-xl font-bold text-foreground">
            {formatMoney(totalAmount, { currency, locale })}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">{t("linesStat")}</p>
          <p className="text-xl font-bold text-foreground">{items.length}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">
            {t("destinationsStat")}
          </p>
          <p className="flex items-center gap-2 text-xl font-bold text-foreground">
            {locations.map((location) => (
              <span key={location.id} className="flex items-center gap-1.5">
                <LocationDot type={location.type} />
                {location.name}
              </span>
            ))}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">{t("newPricesStat")}</p>
          <p className="text-xl font-bold text-foreground">
            {t("newPricesCount", { count: productsWithNewPrice.length })}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row">
        <div className="flex-1 overflow-hidden rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted text-left text-muted-foreground">
                <th className="px-3 py-2 font-medium">
                  {t("lineProductLabel")}
                </th>
                <th className="px-3 py-2 font-medium">
                  {t("locationsColumn")}
                </th>
                <th className="px-3 py-2 text-right font-medium">
                  {t("quantityLabel")}
                </th>
                <th className="px-3 py-2 text-right font-medium">
                  {t("purchasePriceLabel")}, {currencyLabel(currency, locale)}
                </th>
                <th className="px-3 py-2 text-right font-medium">
                  {t("salePriceLabel")}, {currencyLabel(currency, locale)}
                </th>
                <th className="px-3 py-2 text-right font-medium">
                  {t("sumColumn")}, {currencyLabel(currency, locale)}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ item, isSplitChild }) => (
                <tr
                  key={item.id}
                  className="border-b border-border last:border-b-0"
                >
                  <td className="px-3 py-2">
                    {isSplitChild ? (
                      <p className="pl-4 text-sm text-muted-foreground">
                        {/* eslint-disable-next-line i18next/no-literal-string -- decorative glyph, not text */}
                        <span aria-hidden="true">↳ </span>
                        {t("splitSameItem")}
                      </p>
                    ) : (
                      <>
                        <p className="font-medium text-foreground">
                          {item.productName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {item.sku}
                        </p>
                      </>
                    )}
                  </td>
                  <td className="px-3 py-2 text-foreground">
                    <span className="flex items-center gap-1.5">
                      <LocationDot type={item.locationType} />
                      {item.locationName}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right text-foreground">
                    {item.quantity}
                  </td>
                  <td className="px-3 py-2 text-right text-foreground">
                    {formatMoneyBare(item.purchasePrice, { locale })}
                  </td>
                  <td className="px-3 py-2 text-right text-foreground">
                    {item.salePrice !== null
                      ? formatMoneyBare(item.salePrice, { locale })
                      : "—"}
                  </td>
                  <td className="px-3 py-2 text-right font-medium text-foreground">
                    {formatMoneyBare(item.quantity * item.purchasePrice, {
                      locale,
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-border bg-muted/60 font-semibold text-foreground">
                <td className="px-3 py-2" colSpan={5}>
                  {t("totalRow")}
                </td>
                <td className="px-3 py-2 text-right">
                  {formatMoneyBare(totalAmount, { locale })}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="flex w-full flex-col gap-3 rounded-xl border border-border bg-card p-4 lg:w-72">
          <h2 className="text-sm font-semibold text-foreground">
            {t("historyLabel")}
          </h2>
          <div className="flex gap-2">
            <span className="mt-1 size-2 shrink-0 rounded-full bg-success" />
            <div>
              <p className="text-sm font-medium text-foreground">
                {t("postedStatus")}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatInBusinessTimeZone(
                  purchase.createdAt,
                  timezone,
                  locale,
                  { dateStyle: "short", timeStyle: "short" },
                )}{" "}
                · {roleT(purchase.createdByRole)}
              </p>
            </div>
          </div>
          {productsWithNewPrice.length > 0 && (
            <div className="flex gap-2">
              <span className="mt-1 size-2 shrink-0 rounded-full bg-success" />
              <div>
                <p className="text-sm font-medium text-foreground">
                  {t("newPricesHistoryTitle")}
                </p>
                {productsWithNewPrice.map((item) => (
                  <p key={item.id} className="text-xs text-muted-foreground">
                    {item.productName}:{" "}
                    {formatMoneyBare(item.salePrice as number, { locale })}{" "}
                    {currencyLabel(currency, locale)}
                  </p>
                ))}
              </div>
            </div>
          )}
          <p className="border-t border-border pt-3 text-xs text-muted-foreground">
            {t("correctionNote")}
          </p>
        </div>
      </div>
    </div>
  );
}
