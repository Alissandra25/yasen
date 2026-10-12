import { getLocale, getTranslations } from "next-intl/server";
import { formatInBusinessTimeZone } from "@/lib/dates";
import type { TransferSummary } from "@/server/services/transfers";

export async function TransferList({
  transfers,
  timezone,
}: {
  transfers: TransferSummary[];
  timezone: string;
}) {
  const locale = await getLocale();
  const t = await getTranslations("transfers");

  if (transfers.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("empty")}</p>;
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-muted-foreground">
          <th className="py-1 pr-4">{t("dateColumn")}</th>
          <th className="py-1 pr-4">{t("fromColumn")}</th>
          <th className="py-1 pr-4">{t("toColumn")}</th>
          <th className="py-1 pr-4">{t("linesColumn")}</th>
          <th className="py-1 pr-4">{t("quantityColumn")}</th>
        </tr>
      </thead>
      <tbody>
        {transfers.map((transfer) => (
          <tr key={transfer.id} className="border-t border-border">
            <td className="py-1 pr-4 text-foreground">
              {formatInBusinessTimeZone(transfer.createdAt, timezone, locale)}
            </td>
            <td className="py-1 pr-4 text-foreground">
              {transfer.fromLocationName}
            </td>
            <td className="py-1 pr-4 text-foreground">
              {transfer.toLocationName}
            </td>
            <td className="py-1 pr-4 text-foreground">{transfer.lineCount}</td>
            <td className="py-1 pr-4 text-foreground">
              {transfer.totalQuantity}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
