import { Fragment } from "react";
import { getLocale, getTranslations } from "next-intl/server";
import { ArrowRight } from "lucide-react";
import { businessToday, formatInBusinessTimeZone } from "@/lib/dates";
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
    return (
      <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        {t("empty")}
      </p>
    );
  }

  const groups: { day: string; transfers: TransferSummary[] }[] = [];
  for (const transfer of transfers) {
    const key = businessToday(timezone, transfer.createdAt);
    const current = groups.at(-1);
    if (current?.day === key) {
      current.transfers.push(transfer);
    } else {
      groups.push({ day: key, transfers: [transfer] });
    }
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted text-left text-muted-foreground">
            <th className="px-3 py-2 font-medium">{t("dateColumn")}</th>
            <th className="px-3 py-2 font-medium">{t("fromColumn")}</th>
            <th className="px-3 py-2 font-medium" />
            <th className="px-3 py-2 font-medium">{t("toColumn")}</th>
            <th className="px-3 py-2 text-right font-medium">
              {t("linesColumn")}
            </th>
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => (
            <Fragment key={group.day}>
              <tr className="border-b border-border">
                <td
                  colSpan={5}
                  className="bg-muted/60 px-3 py-1.5 text-sm font-semibold text-foreground"
                >
                  {formatInBusinessTimeZone(
                    group.transfers[0].createdAt,
                    timezone,
                    locale,
                    { dateStyle: "long" },
                  )}
                  <span className="ml-2 font-normal text-muted-foreground">
                    {t("dayGroupSummary", { count: group.transfers.length })}
                  </span>
                </td>
              </tr>
              {group.transfers.map((transfer) => (
                <tr
                  key={transfer.id}
                  className="border-b border-border last:border-b-0 hover:bg-muted/40"
                >
                  <td className="px-3 py-2 text-foreground">
                    {formatInBusinessTimeZone(
                      transfer.createdAt,
                      timezone,
                      locale,
                      { timeStyle: "short" },
                    )}
                  </td>
                  <td className="px-3 py-2 font-medium text-foreground">
                    {transfer.fromLocationName}
                  </td>
                  <td className="px-3 py-2">
                    <ArrowRight className="size-3.5 text-muted-foreground" />
                  </td>
                  <td className="px-3 py-2 font-medium text-foreground">
                    {transfer.toLocationName}
                  </td>
                  <td className="px-3 py-2 text-right text-foreground">
                    {transfer.lineCount}
                  </td>
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
