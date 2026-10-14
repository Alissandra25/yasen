import { Fragment } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { businessToday, formatInBusinessTimeZone } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import type { PurchaseSummary } from "@/server/services/purchases";

function dayKey(createdAt: Date, timezone: string) {
  return businessToday(timezone, createdAt);
}

export async function PurchaseList({
  purchases,
  timezone,
  currency,
}: {
  purchases: PurchaseSummary[];
  timezone: string;
  currency: string;
}) {
  const locale = await getLocale();
  const t = await getTranslations("receipts");

  if (purchases.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        {t("empty")}
      </p>
    );
  }

  const groups: { day: string; purchases: PurchaseSummary[] }[] = [];
  for (const purchase of purchases) {
    const key = dayKey(purchase.createdAt, timezone);
    const current = groups.at(-1);
    if (current?.day === key) {
      current.purchases.push(purchase);
    } else {
      groups.push({ day: key, purchases: [purchase] });
    }
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted text-left text-muted-foreground">
            <th className="px-3 py-2 font-medium">{t("dateColumn")}</th>
            <th className="px-3 py-2 font-medium">{t("supplierColumn")}</th>
            <th className="px-3 py-2 font-medium">{t("locationsColumn")}</th>
            <th className="px-3 py-2 text-right font-medium">
              {t("linesColumn")}
            </th>
            <th className="px-3 py-2 text-right font-medium">
              {t("amountColumn")}
            </th>
            <th className="px-3 py-2" />
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => {
            const dayTotal = group.purchases.reduce(
              (sum, purchase) => sum + purchase.totalAmount,
              0,
            );
            return (
              <Fragment key={group.day}>
                <tr className="border-b border-border">
                  <td
                    colSpan={6}
                    className="bg-muted/60 px-3 py-1.5 text-sm font-semibold text-foreground"
                  >
                    {formatInBusinessTimeZone(
                      group.purchases[0].createdAt,
                      timezone,
                      locale,
                      { dateStyle: "long" },
                    )}
                    <span className="ml-2 font-normal text-muted-foreground">
                      {t("dayGroupSummary", {
                        count: group.purchases.length,
                        amount: formatMoney(dayTotal, { currency, locale }),
                      })}
                    </span>
                  </td>
                </tr>
                {group.purchases.map((purchase) => (
                  <tr
                    key={purchase.id}
                    className="border-b border-border last:border-b-0 hover:bg-muted/40"
                  >
                    <td className="px-3 py-2 text-foreground">
                      {formatInBusinessTimeZone(
                        purchase.createdAt,
                        timezone,
                        locale,
                        { timeStyle: "short" },
                      )}
                    </td>
                    <td className="px-3 py-2 font-medium text-foreground">
                      {purchase.supplierName}
                    </td>
                    <td className="px-3 py-2 text-foreground">
                      {purchase.locationNames.join(" + ")}
                    </td>
                    <td className="px-3 py-2 text-right text-foreground">
                      {purchase.lineCount}
                    </td>
                    <td className="px-3 py-2 text-right font-medium text-foreground">
                      {formatMoney(purchase.totalAmount, {
                        currency,
                        locale,
                      })}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Link
                        href={`/${locale}/receipts/${purchase.id}`}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <ChevronRight className="size-4" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
