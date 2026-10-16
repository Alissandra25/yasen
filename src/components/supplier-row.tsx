"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatInBusinessTimeZone } from "@/lib/dates";
import { formatMoneyBare, currencyLabel } from "@/lib/money";
import type { Supplier } from "@/server/services/suppliers";

export function SupplierRow({
  supplier,
  productCount,
  lastDeliveryAt,
  purchased3mo,
  longWithoutDelivery,
  currency,
  timezone,
  selected,
  onToggleSelectedAction,
}: {
  supplier: Supplier;
  productCount: number;
  lastDeliveryAt: Date | null;
  purchased3mo: number;
  longWithoutDelivery: boolean;
  currency: string;
  timezone: string;
  selected: boolean;
  onToggleSelectedAction: () => void;
}) {
  const t = useTranslations("suppliers");
  const locale = useLocale();
  const onlyNameFilled = !supplier.contacts && !supplier.note;

  return (
    <tr className="border-b border-border last:border-b-0 hover:bg-muted/40">
      <td className="px-3 py-2">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelectedAction}
          aria-label={t("selectForBulkAction")}
          className="size-4 rounded border-input accent-primary"
        />
      </td>
      <td className="px-2 py-2">
        <Link
          href={`/${locale}/suppliers/${supplier.id}`}
          className="flex items-center gap-2 font-medium text-foreground hover:underline"
        >
          {supplier.name}
          {supplier.needsReview && (
            <Badge className="bg-warning font-normal text-warning-foreground">
              {onlyNameFilled ? t("nameOnlyBadge") : t("needsReviewBadge")}
            </Badge>
          )}
          {longWithoutDelivery && (
            <Badge variant="secondary" className="font-normal">
              {t("longWithoutDeliveryBadge")}
            </Badge>
          )}
        </Link>
        {supplier.note && (
          <p className="text-xs text-muted-foreground">{supplier.note}</p>
        )}
      </td>
      <td className="px-2 py-2 text-sm whitespace-pre-line text-muted-foreground">
        {supplier.contacts ?? "—"}
      </td>
      <td className="px-2 py-2 text-right text-sm text-foreground">
        {productCount}
      </td>
      <td className="px-2 py-2 text-sm text-muted-foreground">
        {lastDeliveryAt
          ? formatInBusinessTimeZone(lastDeliveryAt, timezone, locale, {
              dateStyle: "medium",
            })
          : "—"}
      </td>
      <td className="px-2 py-2 text-right text-sm text-foreground">
        {purchased3mo > 0
          ? `${formatMoneyBare(purchased3mo, { locale })} ${currencyLabel(currency, locale)}`
          : "—"}
      </td>
      <td className="px-2 py-2 text-right">
        <Link
          href={`/${locale}/suppliers/${supplier.id}`}
          aria-label={t("edit")}
          className="text-muted-foreground hover:text-foreground"
        >
          <ChevronRight className="size-4" />
        </Link>
      </td>
    </tr>
  );
}
