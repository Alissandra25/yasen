"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  postStocktakeAction,
  saveStocktakeCountAction,
} from "@/server/actions/stocktakes";
import type { StocktakeItemRow } from "@/server/services/stocktakes";

type Reason = "breakage" | "shortage" | "mis_sort" | "other";
type StatusFilter = "all" | "uncounted" | "discrepancies";

function difference(item: StocktakeItemRow): number | null {
  if (item.countedQuantity === null) return null;
  return item.countedQuantity - item.systemQuantity;
}

export function StocktakeTable({
  stocktakeId,
  items: initialItems,
  categories,
}: {
  stocktakeId: number;
  items: StocktakeItemRow[];
  categories: { id: number; label: string }[];
}) {
  const t = useTranslations("stocktake");
  const router = useRouter();

  const [items, setItems] = useState(initialItems);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [isPosting, setIsPosting] = useState(false);

  function updateItem(
    productId: number,
    patch: Partial<Pick<StocktakeItemRow, "countedQuantity" | "reason">>,
  ) {
    setItems((prev) =>
      prev.map((item) =>
        item.productId === productId ? { ...item, ...patch } : item,
      ),
    );
  }

  function handleCountChange(item: StocktakeItemRow, raw: string) {
    const parsed = raw === "" ? null : Number.parseInt(raw, 10);
    const countedQuantity = Number.isFinite(parsed) ? parsed : null;
    updateItem(item.productId, { countedQuantity });
    if (countedQuantity !== null) {
      void saveStocktakeCountAction(
        stocktakeId,
        item.productId,
        countedQuantity,
        item.reason,
      );
    }
  }

  function handleReasonChange(item: StocktakeItemRow, reason: Reason) {
    updateItem(item.productId, { reason });
    if (item.countedQuantity !== null) {
      void saveStocktakeCountAction(
        stocktakeId,
        item.productId,
        item.countedQuantity,
        reason,
      );
    }
  }

  const uncountedCount = items.filter((i) => i.countedQuantity === null).length;
  const discrepancyItems = items.filter((i) => {
    const diff = difference(i);
    return diff !== null && diff !== 0;
  });
  const countedCount = items.length - uncountedCount;

  const visible = items
    .filter((item) =>
      categoryFilter ? String(item.categoryId) === categoryFilter : true,
    )
    .filter((item) => {
      if (statusFilter === "uncounted") return item.countedQuantity === null;
      if (statusFilter === "discrepancies") {
        const diff = difference(item);
        return diff !== null && diff !== 0;
      }
      return true;
    })
    .filter((item) => {
      if (!search) return true;
      const q = search.trim().toLowerCase();
      return (
        item.productName.toLowerCase().includes(q) ||
        (item.sku ? item.sku.toLowerCase().includes(q) : false)
      );
    });

  const shortageTotal = discrepancyItems.reduce((sum, item) => {
    const diff = difference(item) ?? 0;
    return diff < 0 ? sum + diff : sum;
  }, 0);
  const surplusTotal = discrepancyItems.reduce((sum, item) => {
    const diff = difference(item) ?? 0;
    return diff > 0 ? sum + diff : sum;
  }, 0);

  async function handlePost() {
    setIsPosting(true);
    const result = await postStocktakeAction(stocktakeId);
    setIsPosting(false);
    if (result.ok) {
      router.push("../../stock");
    }
  }

  const progressPct =
    items.length === 0 ? 0 : Math.round((countedCount / items.length) * 100);

  const statusTabs: { value: StatusFilter; label: string; count: number }[] = [
    { value: "uncounted", label: t("uncountedFilter"), count: uncountedCount },
    {
      value: "discrepancies",
      label: t("discrepanciesFilter"),
      count: discrepancyItems.length,
    },
    { value: "all", label: t("allFilter"), count: items.length },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-foreground">
          {t("progress", { counted: countedCount, total: items.length })}
        </span>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <span className="text-sm text-muted-foreground">{progressPct}%</span>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t("searchPlaceholder")}
          className="h-8 w-56 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
        />
        <select
          value={categoryFilter}
          onChange={(event) => setCategoryFilter(event.target.value)}
          className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
        >
          <option value="">{t("allCategories")}</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.label}
            </option>
          ))}
        </select>
        <div className="inline-flex items-center gap-1 rounded-lg bg-muted p-1">
          {statusTabs.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setStatusFilter(tab.value)}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                statusFilter === tab.value
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {tab.label}
              <Badge variant="secondary">{tab.count}</Badge>
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted text-left text-muted-foreground">
              <th className="px-3 py-2 font-medium">{t("productColumn")}</th>
              <th className="px-2 py-2 text-right font-medium">
                {t("systemColumn")}
              </th>
              <th className="px-2 py-2 text-right font-medium">
                {t("countedColumn")}
              </th>
              <th className="px-2 py-2 text-right font-medium">
                {t("differenceColumn")}
              </th>
              <th className="px-2 py-2 font-medium">{t("reasonColumn")}</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((item) => {
              const diff = difference(item);
              const hasDiscrepancy = diff !== null && diff !== 0;
              return (
                <tr
                  key={item.id}
                  className={cn(
                    "border-b border-border last:border-b-0",
                    hasDiscrepancy && "bg-warning/10",
                  )}
                >
                  <td className="px-3 py-2">
                    <p className="font-medium text-foreground">
                      {item.productName}
                    </p>
                    {item.sku && (
                      <p className="text-xs text-muted-foreground">
                        {item.sku}
                      </p>
                    )}
                  </td>
                  <td className="px-2 py-2 text-right text-muted-foreground">
                    {item.systemQuantity}
                  </td>
                  <td className="px-2 py-2 text-right">
                    <input
                      value={item.countedQuantity ?? ""}
                      onChange={(event) =>
                        handleCountChange(item, event.target.value)
                      }
                      inputMode="numeric"
                      placeholder="—"
                      className="h-8 w-20 rounded-md border border-input bg-transparent text-right text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
                    />
                  </td>
                  <td className="px-2 py-2 text-right">
                    {diff !== null && (
                      <span
                        className={cn(
                          "font-semibold",
                          diff > 0 && "text-success",
                          diff < 0 && "text-destructive",
                          diff === 0 && "text-muted-foreground",
                        )}
                      >
                        {diff > 0 ? "+" : ""}
                        {diff}
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-2">
                    {hasDiscrepancy && (
                      <select
                        value={item.reason ?? ""}
                        onChange={(event) =>
                          handleReasonChange(item, event.target.value as Reason)
                        }
                        className={cn(
                          "h-8 rounded-md border bg-transparent px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
                          item.reason
                            ? "border-input text-foreground"
                            : "border-warning text-warning-foreground",
                        )}
                      >
                        <option value="">{t("chooseReason")}</option>
                        <option value="breakage">{t("reason.breakage")}</option>
                        <option value="shortage">{t("reason.shortage")}</option>
                        <option value="mis_sort">{t("reason.mis_sort")}</option>
                        <option value="other">{t("reason.other")}</option>
                      </select>
                    )}
                  </td>
                </tr>
              );
            })}
            {visible.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-3 py-6 text-center text-sm text-muted-foreground"
                >
                  {t("noMatches")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4">
        <p className="text-sm text-muted-foreground">
          {t("summary", {
            count: discrepancyItems.length,
            shortage: shortageTotal,
            surplus: surplusTotal,
          })}
        </p>
        <Button
          type="button"
          disabled={isPosting}
          onClick={() => void handlePost()}
        >
          {t("postButton")}
        </Button>
      </div>
    </div>
  );
}
