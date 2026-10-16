"use client";

import { Fragment, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ArrowRight, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { LocationDot } from "@/components/location-dot";
import { businessToday, formatInBusinessTimeZone } from "@/lib/dates";
import type { TransferSummary } from "@/server/services/transfers";

const PAGE_SIZE = 8;

export function TransferList({
  transfers,
  timezone,
}: {
  transfers: TransferSummary[];
  timezone: string;
}) {
  const locale = useLocale();
  const t = useTranslations("transfers");
  const [search, setSearch] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const roleT = useTranslations("roles");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return transfers;
    return transfers.filter(
      (transfer) =>
        String(transfer.id).includes(q) ||
        transfer.fromLocationName.toLowerCase().includes(q) ||
        transfer.toLocationName.toLowerCase().includes(q),
    );
  }, [transfers, search]);

  const visible = filtered.slice(0, visibleCount);

  if (transfers.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        {t("empty")}
      </p>
    );
  }

  const groups: { day: string; transfers: TransferSummary[] }[] = [];
  for (const transfer of visible) {
    const key = businessToday(timezone, transfer.createdAt);
    const current = groups.at(-1);
    if (current?.day === key) {
      current.transfers.push(transfer);
    } else {
      groups.push({ day: key, transfers: [transfer] });
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative max-w-xs">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t("searchPlaceholder")}
          className="h-8 w-full rounded-lg border border-input bg-transparent pr-2 pl-8 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted text-left text-muted-foreground">
              <th className="px-3 py-2 font-medium">{t("numberColumn")}</th>
              <th className="px-3 py-2 font-medium">{t("timeColumn")}</th>
              <th className="px-3 py-2 font-medium">{t("fromColumn")}</th>
              <th className="px-3 py-2 font-medium" />
              <th className="px-3 py-2 font-medium">{t("toColumn")}</th>
              <th className="px-3 py-2 text-right font-medium">
                {t("linesColumn")}
              </th>
              <th className="px-3 py-2 font-medium">{t("postedByColumn")}</th>
              <th className="px-3 py-2 font-medium">{t("statusColumn")}</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => (
              <Fragment key={group.day}>
                <tr className="border-b border-border">
                  <td
                    colSpan={8}
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
                    <td className="px-3 py-2 font-semibold text-foreground">
                      {t("numberColumn")} {transfer.id}
                    </td>
                    <td className="px-3 py-2 text-foreground">
                      {formatInBusinessTimeZone(
                        transfer.createdAt,
                        timezone,
                        locale,
                        { timeStyle: "short" },
                      )}
                    </td>
                    <td className="px-3 py-2 font-medium text-foreground">
                      <span className="flex items-center gap-1.5">
                        <LocationDot type={transfer.fromLocationType} />
                        {transfer.fromLocationName}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <ArrowRight className="size-3.5 text-muted-foreground" />
                    </td>
                    <td className="px-3 py-2 font-medium text-foreground">
                      <span className="flex items-center gap-1.5">
                        <LocationDot type={transfer.toLocationType} />
                        {transfer.toLocationName}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right text-foreground">
                      {transfer.lineCount}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {roleT(transfer.createdByRole)}
                    </td>
                    <td className="px-3 py-2">
                      <Badge className="bg-success/15 font-normal text-success">
                        {t("postedStatus")}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {filtered.length > 0 && (
        <p className="text-sm text-muted-foreground">
          {t("shownCount", { shown: visible.length, total: filtered.length })}
          {visibleCount < filtered.length && (
            <>
              {" · "}
              <button
                type="button"
                onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
                className="text-foreground underline-offset-2 hover:underline"
              >
                {t("showMore")}
              </button>
            </>
          )}
        </p>
      )}
    </div>
  );
}
