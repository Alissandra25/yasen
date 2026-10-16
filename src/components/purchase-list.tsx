"use client";

import { Fragment, useMemo, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { LocationDot } from "@/components/location-dot";
import { businessToday, formatInBusinessTimeZone } from "@/lib/dates";
import { formatMoneyBare } from "@/lib/money";
import type { PurchaseSummary } from "@/server/services/purchases";

const PAGE_SIZE = 8;

function dayKey(createdAt: Date, timezone: string) {
  return businessToday(timezone, createdAt);
}

export function PurchaseList({
  purchases,
  timezone,
}: {
  purchases: PurchaseSummary[];
  timezone: string;
}) {
  const t = useTranslations("receipts");
  const locale = useLocale();
  const [search, setSearch] = useState("");
  const [supplierFilter, setSupplierFilter] = useState<number | "all">("all");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const suppliers = useMemo(() => {
    const map = new Map<number, string>();
    for (const purchase of purchases) {
      map.set(purchase.supplierId, purchase.supplierName);
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [purchases]);

  const filtered = purchases.filter((purchase) => {
    if (supplierFilter !== "all" && purchase.supplierId !== supplierFilter) {
      return false;
    }
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return (
      purchase.supplierName.toLowerCase().includes(q) ||
      String(purchase.id).includes(q)
    );
  });

  const visible = filtered.slice(0, visibleCount);

  if (purchases.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        {t("empty")}
      </p>
    );
  }

  const groups: { day: string; purchases: PurchaseSummary[] }[] = [];
  for (const purchase of visible) {
    const key = dayKey(purchase.createdAt, timezone);
    const current = groups.at(-1);
    if (current?.day === key) {
      current.purchases.push(purchase);
    } else {
      groups.push({ day: key, purchases: [purchase] });
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-xs flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("searchPlaceholder")}
            className="h-8 w-full rounded-lg border border-input bg-transparent pr-2 pl-8 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
          />
        </div>
        <select
          value={supplierFilter}
          onChange={(event) =>
            setSupplierFilter(
              event.target.value === "all" ? "all" : Number(event.target.value),
            )
          }
          className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground outline-none"
        >
          <option value="all">
            {t("supplierColumn")}: {t("allSuppliers")}
          </option>
          {suppliers.map((supplier) => (
            <option key={supplier.id} value={supplier.id}>
              {supplier.name}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-hidden rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted text-left text-muted-foreground">
              <th className="px-3 py-2 font-medium">{t("numberColumn")}</th>
              <th className="px-3 py-2 font-medium">{t("timeColumn")}</th>
              <th className="px-3 py-2 font-medium">{t("supplierColumn")}</th>
              <th className="px-3 py-2 font-medium">{t("locationsColumn")}</th>
              <th className="px-3 py-2 text-right font-medium">
                {t("linesColumn")}
              </th>
              <th className="px-3 py-2 text-right font-medium">
                {t("amountColumn")}
              </th>
              <th className="px-3 py-2 font-medium">{t("postedByColumn")}</th>
              <th className="px-3 py-2 font-medium">{t("statusColumn")}</th>
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
                      colSpan={8}
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
                          amount: formatMoneyBare(dayTotal, { locale }),
                        })}
                      </span>
                    </td>
                  </tr>
                  {group.purchases.map((purchase) => (
                    <tr
                      key={purchase.id}
                      className="border-b border-border last:border-b-0 hover:bg-muted/40"
                    >
                      <td className="px-3 py-2">
                        <Link
                          href={`/${locale}/receipts/${purchase.id}`}
                          className="font-semibold text-foreground hover:underline"
                        >
                          {t("numberColumn")} {purchase.id}
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-foreground">
                        {formatInBusinessTimeZone(
                          purchase.createdAt,
                          timezone,
                          locale,
                          { timeStyle: "short" },
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <p className="font-medium text-foreground">
                          {purchase.supplierName}
                        </p>
                        {purchase.supplierNeedsReview && (
                          <Badge
                            variant="outline"
                            className="mt-0.5 font-normal"
                          >
                            {t("newSupplierBadge")}
                          </Badge>
                        )}
                      </td>
                      <td className="px-3 py-2 text-foreground">
                        <span className="flex items-center gap-1.5">
                          {purchase.locations.map((location) => (
                            <LocationDot
                              key={location.id}
                              type={location.type}
                            />
                          ))}
                          {purchase.locations.map((l) => l.name).join(" + ")}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right text-foreground">
                        {purchase.lineCount}
                      </td>
                      <td className="px-3 py-2 text-right font-medium text-foreground">
                        {formatMoneyBare(purchase.totalAmount, { locale })}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {t("ownerRole")}
                      </td>
                      <td className="px-3 py-2">
                        <Badge className="bg-success/15 font-normal text-success">
                          {t("postedStatus")}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {filtered.length > 0 && (
        <p className="text-sm text-muted-foreground">
          {t("shownCount", {
            shown: visible.length,
            total: filtered.length,
          })}
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
