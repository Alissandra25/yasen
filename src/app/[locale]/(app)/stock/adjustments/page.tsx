import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { ChevronLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { LocationDot } from "@/components/location-dot";
import { formatInBusinessTimeZone } from "@/lib/dates";
import { getCurrentBusiness } from "@/server/services/business";
import { listStockAdjustments } from "@/server/services/stock-adjustments";
import { requireOwner } from "@/server/session";

export default async function StockAdjustmentsPage() {
  const user = await requireOwner();
  const t = await getTranslations("stock");
  const locale = await getLocale();
  const business = await getCurrentBusiness();
  const timezone = business?.timezone ?? "Europe/Kyiv";

  const adjustments = await listStockAdjustments(user.businessId);

  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <div>
        <Link
          href={`/${locale}/stock`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
          {t("backToStock")}
        </Link>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground">
          {t("adjustmentsHistoryTitle")}
        </h1>
      </div>

      {adjustments.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          {t("adjustmentsEmpty")}
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted text-left text-muted-foreground">
                <th className="px-3 py-2 font-medium">{t("timeColumn")}</th>
                <th className="px-3 py-2 font-medium">{t("productColumn")}</th>
                <th className="px-3 py-2 font-medium">{t("whereLabel")}</th>
                <th className="px-3 py-2 text-right font-medium">
                  {t("inSystemLabel")}
                </th>
                <th className="px-3 py-2 text-right font-medium">
                  {t("newQuantityLabel")}
                </th>
                <th className="px-3 py-2 font-medium">{t("reasonLabel")}</th>
                <th className="px-3 py-2 font-medium">{t("commentLabel")}</th>
                <th className="px-3 py-2 font-medium">
                  {t("adjustedByColumn")}
                </th>
              </tr>
            </thead>
            <tbody>
              {adjustments.map((adjustment) => (
                <tr
                  key={adjustment.id}
                  className="border-b border-border last:border-b-0"
                >
                  <td className="px-3 py-2 text-foreground">
                    {formatInBusinessTimeZone(
                      adjustment.adjustedAt,
                      timezone,
                      locale,
                      { dateStyle: "medium", timeStyle: "short" },
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <p className="font-medium text-foreground">
                      {adjustment.productName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {adjustment.sku}
                    </p>
                  </td>
                  <td className="px-3 py-2 text-foreground">
                    <span className="flex items-center gap-1.5">
                      <LocationDot type={adjustment.locationType} />
                      {adjustment.locationName}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right text-foreground">
                    {adjustment.oldQuantity}
                  </td>
                  <td className="px-3 py-2 text-right font-medium text-foreground">
                    {adjustment.newQuantity}
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant="outline" className="font-normal">
                      {t(`reason.${adjustment.reason}`)}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {adjustment.comment ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {adjustment.adjustedByEmail}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
