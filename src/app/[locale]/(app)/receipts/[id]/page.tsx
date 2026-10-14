import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import { formatInBusinessTimeZone } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
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
  const locationNames = Array.from(
    new Set(items.map((item) => item.locationName)),
  );

  return (
    <div className="flex max-w-5xl flex-col gap-6 px-6 py-8">
      <div>
        <Link
          href={`/${locale}/receipts`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          {t("backToAll")}
        </Link>
        <div className="mt-1 flex items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {t("detailTitle", { id: purchase.id })}
          </h1>
          <Badge className="bg-success/15 font-medium text-success">
            {t("postedStatus")}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {t("postedBy", {
            supplier: purchase.supplierName,
            date: formatInBusinessTimeZone(
              purchase.createdAt,
              timezone,
              locale,
              {
                dateStyle: "long",
              },
            ),
            role: roleT(purchase.createdByRole),
            time: formatInBusinessTimeZone(
              purchase.createdAt,
              timezone,
              locale,
              {
                timeStyle: "short",
              },
            ),
          })}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
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
          <p className="text-xl font-bold text-foreground">
            {locationNames.join(" · ")}
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted text-left text-muted-foreground">
              <th className="px-3 py-2 font-medium">{t("lineProductLabel")}</th>
              <th className="px-3 py-2 font-medium">{t("skuColumn")}</th>
              <th className="px-3 py-2 font-medium">{t("locationsColumn")}</th>
              <th className="px-3 py-2 text-right font-medium">
                {t("quantityLabel")}
              </th>
              <th className="px-3 py-2 text-right font-medium">
                {t("purchasePriceLabel")}
              </th>
              <th className="px-3 py-2 text-right font-medium">
                {t("salePriceLabel")}
              </th>
              <th className="px-3 py-2 text-right font-medium">
                {t("amountColumn")}
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr
                key={item.id}
                className="border-b border-border last:border-b-0"
              >
                <td className="px-3 py-2 font-medium text-foreground">
                  {item.productName}
                </td>
                <td className="px-3 py-2 text-muted-foreground">
                  {item.sku ?? ""}
                </td>
                <td className="px-3 py-2 text-foreground">
                  {item.locationName}
                </td>
                <td className="px-3 py-2 text-right text-foreground">
                  {item.quantity}
                </td>
                <td className="px-3 py-2 text-right text-foreground">
                  {formatMoney(item.purchasePrice, { currency, locale })}
                </td>
                <td className="px-3 py-2 text-right text-foreground">
                  {item.salePrice !== null
                    ? formatMoney(item.salePrice, { currency, locale })
                    : "—"}
                </td>
                <td className="px-3 py-2 text-right font-medium text-foreground">
                  {formatMoney(item.quantity * item.purchasePrice, {
                    currency,
                    locale,
                  })}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-border bg-muted/60 font-semibold text-foreground">
              <td className="px-3 py-2" colSpan={4}>
                {t("totalRow")}
              </td>
              <td className="px-3 py-2" colSpan={2} />
              <td className="px-3 py-2 text-right">
                {formatMoney(totalAmount, { currency, locale })}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
