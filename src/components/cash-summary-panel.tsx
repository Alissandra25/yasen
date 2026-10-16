"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { addDaysToDateString, formatDayLabelFull } from "@/lib/dates";
import { currencyLabel, formatMoney, formatMoneyBare } from "@/lib/money";
import { setCashAdjustmentAction } from "@/server/actions/cash-adjustments";
import type { DailyCashSummary } from "@/server/services/cash-adjustments";

const AUTOSAVE_DELAY_MS = 700;

export function CashSummaryPanel({
  day,
  locationId,
  month,
  summary,
  currency,
  locale,
}: {
  day: string;
  locationId: number;
  month: string;
  summary: DailyCashSummary;
  currency: string;
  locale: string;
}) {
  const t = useTranslations("cashSummary");
  const router = useRouter();
  const moneyOptions = { currency, locale };

  const [discountRaw, setDiscountRaw] = useState(
    summary.adjustmentAmount === 0
      ? ""
      : String(-summary.adjustmentAmount / 100),
  );
  const [note, setNote] = useState(summary.adjustmentNote ?? "");
  const [error, setError] = useState(false);
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The server pushes a fresh `summary` after navigating to another day or after this panel's
  // own autosave calls router.refresh() — resync the fields whenever that happens. Adjusting
  // state during render (not useEffect+setState) picks it up in the same pass, same pattern as
  // sales-matrix.tsx's syncedTotals.
  const summaryKey = `${day}|${summary.adjustmentAmount}|${summary.adjustmentNote ?? ""}`;
  const [syncedKey, setSyncedKey] = useState(summaryKey);
  if (summaryKey !== syncedKey) {
    setSyncedKey(summaryKey);
    setDiscountRaw(
      summary.adjustmentAmount === 0
        ? ""
        : String(-summary.adjustmentAmount / 100),
    );
    setNote(summary.adjustmentNote ?? "");
  }

  useEffect(() => {
    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    };
  }, []);

  function scheduleSave(nextDiscountRaw: string, nextNote: string) {
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(
      () => void save(nextDiscountRaw, nextNote),
      AUTOSAVE_DELAY_MS,
    );
  }

  async function save(nextDiscountRaw: string, nextNote: string) {
    const result = await setCashAdjustmentAction({
      locationId,
      date: day,
      discountAmountRaw: nextDiscountRaw,
      note: nextNote.trim() || null,
    });
    if (!result.ok) {
      setError(true);
      return;
    }
    setError(false);
    router.refresh();
  }

  function goToDay(nextDay: string) {
    router.push(`?month=${month}&locationId=${locationId}&day=${nextDay}`);
  }

  const cashCardTotal = summary.cash + summary.card;
  const cashPercent =
    cashCardTotal > 0 ? (summary.cash / cashCardTotal) * 100 : 50;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-label={t("previousDay")}
          onClick={() => goToDay(addDaysToDateString(day, -1))}
          className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
        </button>
        <div className="flex flex-1 flex-col items-center text-center">
          <span className="text-[0.65rem] font-semibold tracking-wide text-muted-foreground uppercase">
            {t("title")}
          </span>
          <span className="text-sm font-semibold text-foreground">
            {formatDayLabelFull(day, locale)}
          </span>
        </div>
        <button
          type="button"
          aria-label={t("nextDay")}
          onClick={() => goToDay(addDaysToDateString(day, 1))}
          className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-2xl font-bold text-foreground">
          {formatMoneyBare(summary.grossTotal, { locale })}{" "}
          <span className="text-base font-normal text-muted-foreground">
            {currencyLabel(currency, locale)}
          </span>
        </p>
        <div className="flex h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="bg-primary"
            style={{ width: `${cashPercent}%` }}
            aria-hidden="true"
          />
          <div
            className="bg-chart-1"
            style={{ width: `${100 - cashPercent}%` }}
            aria-hidden="true"
          />
        </div>
        <div className="flex flex-col gap-1.5 text-sm">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-foreground">
              <span
                className="size-2 rounded-full bg-primary"
                aria-hidden="true"
              />
              {t("cash")}
            </span>
            <span className="font-medium text-foreground">
              {formatMoney(summary.cash, moneyOptions)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-foreground">
              <span
                className="size-2 rounded-full bg-chart-1"
                aria-hidden="true"
              />
              {t("card")}
            </span>
            <span className="font-medium text-foreground">
              {formatMoney(summary.card, moneyOptions)}
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-1.5 border-t border-border pt-3">
        <span className="text-xs font-semibold text-muted-foreground uppercase">
          {t("discountsHeading")}
        </span>
        <div className="flex items-center gap-2">
          <div className="flex h-8 items-center gap-1 rounded-lg border border-input px-2">
            <span className="text-muted-foreground">−</span>
            <input
              aria-label={t("discountsHeading")}
              value={discountRaw}
              onChange={(event) => {
                setDiscountRaw(event.target.value);
                scheduleSave(event.target.value, note);
              }}
              className="w-12 bg-transparent text-right text-sm outline-none"
              inputMode="decimal"
              placeholder="0"
            />
            <span className="text-xs text-muted-foreground">
              {currencyLabel(currency, locale)}
            </span>
          </div>
          <input
            aria-label={t("discountNotePlaceholder")}
            value={note}
            onChange={(event) => {
              setNote(event.target.value);
              scheduleSave(discountRaw, event.target.value);
            }}
            placeholder={t("discountNotePlaceholder")}
            className="h-8 flex-1 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
          />
        </div>
        {error && (
          <p className="text-xs text-destructive" role="alert">
            {t("invalidInput")}
          </p>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-border pt-3">
        <span className="font-semibold text-foreground">{t("netTotal")}</span>
        <span className="text-lg font-bold text-foreground">
          {formatMoney(summary.netTotal, moneyOptions)}
        </span>
      </div>

      <p className="text-xs text-muted-foreground">{t("hint")}</p>
    </div>
  );
}
