import { getLocale, getTranslations } from "next-intl/server";
import { formatInBusinessTimeZone } from "@/lib/dates";
import type { PurchaseSummary } from "@/server/services/purchases";

export async function PurchaseList({
  purchases,
  timezone,
}: {
  purchases: PurchaseSummary[];
  timezone: string;
}) {
  const locale = await getLocale();
  const t = await getTranslations("receipts");

  if (purchases.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("empty")}</p>;
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-muted-foreground">
          <th className="py-1 pr-4">{t("dateColumn")}</th>
          <th className="py-1 pr-4">{t("supplierColumn")}</th>
          <th className="py-1 pr-4">{t("linesColumn")}</th>
          <th className="py-1 pr-4">{t("quantityColumn")}</th>
        </tr>
      </thead>
      <tbody>
        {purchases.map((purchase) => (
          <tr key={purchase.id} className="border-t border-border">
            <td className="py-1 pr-4 text-foreground">
              {formatInBusinessTimeZone(purchase.createdAt, timezone, locale)}
            </td>
            <td className="py-1 pr-4 text-foreground">
              {purchase.supplierName}
            </td>
            <td className="py-1 pr-4 text-foreground">{purchase.lineCount}</td>
            <td className="py-1 pr-4 text-foreground">
              {purchase.totalQuantity}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
