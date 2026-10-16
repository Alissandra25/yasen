"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SupplierRow } from "@/components/supplier-row";
import { confirmSuppliersReviewedAction } from "@/server/actions/suppliers";
import type { Supplier } from "@/server/services/suppliers";
import { cn } from "@/lib/utils";

function normalize(value: string) {
  return value.trim().toLowerCase();
}

const SUPPLIER_PILL_KEYS = ["needsReview", "longWithoutDelivery"] as const;

interface SupplierRowData {
  supplier: Supplier;
  productCount: number;
  lastDeliveryAt: Date | null;
  purchased3mo: number;
  longWithoutDelivery: boolean;
}

type Pill = "needsReview" | "longWithoutDelivery" | "archived" | null;

export function SupplierList({
  rows,
  archivedSuppliers,
  archivedCount,
  currency,
  timezone,
}: {
  rows: SupplierRowData[];
  archivedSuppliers: Supplier[];
  archivedCount: number;
  currency: string;
  timezone: string;
}) {
  const t = useTranslations("suppliers");
  const [pill, setPill] = useState<Pill>(null);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const needsReviewCount = rows.filter((r) => r.supplier.needsReview).length;
  const longWithoutDeliveryCount = rows.filter(
    (r) => r.longWithoutDelivery,
  ).length;

  const searchQuery = normalize(search);
  const baseRows =
    pill === "archived"
      ? archivedSuppliers.map((supplier) => ({
          supplier,
          productCount: 0,
          lastDeliveryAt: null,
          purchased3mo: 0,
          longWithoutDelivery: false,
        }))
      : rows;

  const visible = baseRows
    .filter((row) => {
      if (pill === "needsReview") return row.supplier.needsReview;
      if (pill === "longWithoutDelivery") return row.longWithoutDelivery;
      return true;
    })
    .filter((row) => {
      if (!searchQuery) return true;
      const matchesName = normalize(row.supplier.name).includes(searchQuery);
      const matchesContacts = row.supplier.contacts
        ? normalize(row.supplier.contacts).includes(searchQuery)
        : false;
      return matchesName || matchesContacts;
    });

  function toggleSelected(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  async function confirmSelected() {
    await confirmSuppliersReviewedAction(Array.from(selected));
    setSelected(new Set());
  }

  return (
    <div className="flex flex-col gap-4">
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
        {SUPPLIER_PILL_KEYS.map((key) => {
          const label =
            key === "needsReview"
              ? t("needsReviewFilter")
              : t("longWithoutDeliveryFilter");
          const count =
            key === "needsReview" ? needsReviewCount : longWithoutDeliveryCount;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setPill((prev) => (prev === key ? null : key))}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium transition-colors",
                pill === key
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-input text-foreground hover:bg-muted",
              )}
            >
              {label}
              <span
                className={cn(
                  "rounded-full px-1.5 text-xs",
                  pill === key
                    ? "bg-primary-foreground/20"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
        <button
          type="button"
          onClick={() =>
            setPill((prev) => (prev === "archived" ? null : "archived"))
          }
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium transition-colors",
            pill === "archived"
              ? "border-primary bg-primary text-primary-foreground"
              : "border-input text-foreground hover:bg-muted",
          )}
        >
          {t("archivedFilter")}
          <span
            className={cn(
              "rounded-full px-1.5 text-xs",
              pill === "archived"
                ? "bg-primary-foreground/20"
                : "bg-muted text-muted-foreground",
            )}
          >
            {archivedCount}
          </span>
        </button>
      </div>

      {selected.size > 0 && (
        <div className="flex items-center justify-between gap-3 rounded-lg bg-accent px-3 py-2">
          <span className="text-sm font-medium text-accent-foreground">
            {t("selectedCount", { count: selected.size })}
          </span>
          <Button
            type="button"
            size="sm"
            onClick={() => void confirmSelected()}
          >
            {t("confirmSelected", { count: selected.size })}
          </Button>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted text-left text-muted-foreground">
              <th className="w-8 px-3 py-2" />
              <th className="px-2 py-2 font-medium">{t("nameLabel")}</th>
              <th className="px-2 py-2 font-medium">{t("contactsLabel")}</th>
              <th className="px-2 py-2 text-right font-medium">
                {t("productsColumn")}
              </th>
              <th className="px-2 py-2 font-medium">
                {t("lastDeliveryColumn")}
              </th>
              <th className="px-2 py-2 text-right font-medium">
                {t("purchased3moColumn")}
              </th>
              <th className="w-8 px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <SupplierRow
                key={row.supplier.id}
                supplier={row.supplier}
                productCount={row.productCount}
                lastDeliveryAt={row.lastDeliveryAt}
                purchased3mo={row.purchased3mo}
                longWithoutDelivery={row.longWithoutDelivery}
                currency={currency}
                timezone={timezone}
                selected={selected.has(row.supplier.id)}
                onToggleSelectedAction={() => toggleSelected(row.supplier.id)}
              />
            ))}
            {visible.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-3 py-6 text-center text-sm text-muted-foreground"
                >
                  {t("empty")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">{t("scrollCaption")}</p>
    </div>
  );
}
